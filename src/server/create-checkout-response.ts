import { env as cloudflareEnv } from "cloudflare:workers";
import { createSupabaseAdmin } from "./supabase-admin";
import { json } from "./security-headers";
import {
  addServerBreadcrumb,
  captureServerException,
  startServerSpan,
} from "./sentry";
import { createStripe } from "./stripe";
import { getMatchingDeliveryZone } from "../lib/shop";
type CartItem = {
  variantId: string;
  quantity: number;
};

export type ServerEnv = Record<string, string | undefined>;

function createOrderNumber() {
  const year = new Date().getFullYear();
  return `HR-${year}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function isLocalRequest(url: string) {
  const hostname = new URL(url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export async function createCheckoutResponse({
  request,
  env,
}: {
  request: Request;
  env: ServerEnv;
}) {
  try {
    console.log("Checkout create: request ontvangen");
    const body = await request.json();
    const requestOrigin = new URL(request.url).origin;
    const shopClosesAt =
      env.SHOP_CLOSES_AT ??
      cloudflareEnv.SHOP_CLOSES_AT ??
      process.env.SHOP_CLOSES_AT;
    const siteUrl =
      env.SITE_URL ?? cloudflareEnv.SITE_URL ?? process.env.SITE_URL;
    const checkoutBaseUrl = requestOrigin || siteUrl;

    if (!shopClosesAt) {
      return json({ error: "SHOP_CLOSES_AT ontbreekt op de server." }, 500);
    }

    if (!checkoutBaseUrl) {
      return json({ error: "SITE_URL ontbreekt op de server." }, 500);
    }

    const closeAt = new Date(shopClosesAt);
    if (new Date() > closeAt) {
      return json({ error: "De webshop is gesloten." }, 400);
    }

    const cart = Array.isArray(body.cart) ? (body.cart as CartItem[]) : [];
    if (!cart.length) {
      return json({ error: "Je winkelmandje is leeg." }, 400);
    }

    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const fulfillmentType = String(body.fulfillmentType || "").trim();
    const pickupSlotId = body.pickupSlotId ? String(body.pickupSlotId) : null;
    const addressLine1 = body.addressLine1
      ? String(body.addressLine1).trim()
      : null;
    const postalCode = body.postalCode ? String(body.postalCode).trim() : null;
    const city = body.city ? String(body.city).trim() : null;

    if (!customerName || !customerEmail) {
      return json({ error: "Naam en e-mail zijn verplicht." }, 400);
    }

    if (fulfillmentType !== "pickup" && fulfillmentType !== "delivery") {
      return json({ error: "Ongeldige ontvangstoptie." }, 400);
    }

    if (fulfillmentType === "pickup" && !pickupSlotId) {
      return json({ error: "Kies een afhaaldatum." }, 400);
    }

    if (fulfillmentType === "delivery") {
      if (!addressLine1 || !postalCode || !city) {
        return json({ error: "Vul het leveradres volledig in." }, 400);
      }
    }

    const supabase = createSupabaseAdmin(env);
    const stripe = createStripe(env);
    console.log("Checkout create: serverclients aangemaakt");
    addServerBreadcrumb({
      category: "checkout",
      message: "Checkout create gestart",
      data: {
        itemCount: cart.length,
        fulfillmentType,
      },
    });

    const variantIds = cart.map((item) => item.variantId);
    const { data: variants, error: variantsError } = await startServerSpan(
      "checkout.fetch_variants",
      {
        "checkout.item_count": cart.length,
        "checkout.fulfillment_type": fulfillmentType,
      },
      () =>
        supabase
          .from("product_variants")
          .select(
            `
            id,
            product_id,
            label,
            size,
            color,
            price_cents,
            stock_quantity,
            is_active,
            products:products (
              id,
              name,
              slug,
              is_active
            )
          `,
          )
          .in("id", variantIds),
    );

    if (variantsError) {
      console.error("Checkout create: varianten query fout", variantsError);
      return json(
        { error: "Kon productinformatie momenteel niet ophalen." },
        500,
      );
    }
    console.log("Checkout create: varianten opgehaald", {
      requested: variantIds.length,
      found: variants?.length ?? 0,
    });

    const variantMap = new Map(
      (variants || []).map((variant: any) => [variant.id, variant]),
    );

    let subtotalCents = 0;
    const normalizedItems: Array<{
      variant_id: string;
      product_name_snapshot: string;
      variant_name_snapshot: string;
      unit_price_cents: number;
      quantity: number;
      line_total_cents: number;
    }> = [];

    for (const item of cart) {
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return json({ error: "Ongeldig aantal in winkelmandje." }, 400);
      }

      const variant: any = variantMap.get(item.variantId);
      if (!variant || !variant.is_active || !variant.products?.is_active) {
        return json(
          { error: "Een productvariant is niet meer beschikbaar." },
          400,
        );
      }

      if (variant.stock_quantity < quantity) {
        return json(
          {
            error: `Niet genoeg voorraad voor ${variant.products.name} ${variant.label}.`,
          },
          400,
        );
      }

      const lineTotal = variant.price_cents * quantity;
      subtotalCents += lineTotal;

      normalizedItems.push({
        variant_id: variant.id,
        product_name_snapshot: variant.products.name,
        variant_name_snapshot: variant.label,
        unit_price_cents: variant.price_cents,
        quantity,
        line_total_cents: lineTotal,
      });
    }

    let deliveryFeeCents = 0;

    if (fulfillmentType === "pickup") {
      const { data: pickupSlot, error: pickupError } = await startServerSpan(
        "checkout.validate_pickup_slot",
        {
          "checkout.fulfillment_type": fulfillmentType,
        },
        () =>
          supabase
            .from("pickup_slots")
            .select("id, is_active")
            .eq("id", pickupSlotId)
            .single(),
      );

      if (pickupError || !pickupSlot?.is_active) {
        if (pickupError) {
          console.error("Checkout create: pickup slot fout", pickupError);
        }
        return json({ error: "Ongeldig afhaalmoment." }, 400);
      }
    }

    if (fulfillmentType === "delivery") {
      if (!postalCode || !city) {
        return json({ error: "Vul het leveradres volledig in." }, 400);
      }

      const { data: deliveryZones, error: deliveryError } =
        await startServerSpan(
          "checkout.validate_delivery_zone",
          {
            "checkout.fulfillment_type": fulfillmentType,
            "checkout.postal_code": postalCode,
            "checkout.city": city,
          },
          () =>
            supabase
              .from("delivery_zones")
              .select("id, postal_code, city, delivery_fee_cents, is_active")
              .eq("postal_code", postalCode)
              .eq("is_active", true),
        );

      if (deliveryError) {
        console.error(
          "Checkout create: delivery zones query fout",
          deliveryError,
        );

        return json(
          { error: "Kon leverzones momenteel niet controleren." },
          500,
        );
      }

      const deliveryZone = getMatchingDeliveryZone(
        deliveryZones ?? [],
        postalCode,
        city,
      );

      if (!deliveryZone) {
        return json(
          { error: "Levering is niet beschikbaar voor deze postcode." },
          400,
        );
      }

      deliveryFeeCents = deliveryZone.delivery_fee_cents ?? 0;
    }

    const totalCents = subtotalCents + deliveryFeeCents;
    const orderNumber = createOrderNumber();

    const { data: createdOrder, error: orderError } = await startServerSpan(
      "checkout.create_order",
      {
        "checkout.fulfillment_type": fulfillmentType,
        "checkout.total_cents": totalCents,
      },
      () =>
        supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            status: "pending_payment",
            fulfillment_type: fulfillmentType,
            pickup_slot_id: fulfillmentType === "pickup" ? pickupSlotId : null,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            address_line1: fulfillmentType === "delivery" ? addressLine1 : null,
            postal_code: fulfillmentType === "delivery" ? postalCode : null,
            city: fulfillmentType === "delivery" ? city : null,
            subtotal_cents: subtotalCents,
            delivery_fee_cents: deliveryFeeCents,
            total_cents: totalCents,
          })
          .select("id, order_number")
          .single(),
    );

    if (orderError || !createdOrder) {
      if (orderError) {
        console.error("Checkout create: order insert fout", orderError);
      }
      return json({ error: "Kon bestelling momenteel niet aanmaken." }, 500);
    }
    console.log("Checkout create: order aangemaakt", {
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number,
    });

    const orderItemsPayload = normalizedItems.map((item) => ({
      order_id: createdOrder.id,
      ...item,
    }));

    const { error: orderItemsError } = await startServerSpan(
      "checkout.create_order_items",
      {
        "checkout.item_count": orderItemsPayload.length,
      },
      () => supabase.from("order_items").insert(orderItemsPayload),
    );

    if (orderItemsError) {
      console.error(
        "Checkout create: order items insert fout",
        orderItemsError,
      );
      return json(
        { error: "Kon bestelling momenteel niet volledig opslaan." },
        500,
      );
    }
    console.log("Checkout create: order items opgeslagen", {
      count: orderItemsPayload.length,
    });

    const stripeLineItems = normalizedItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "eur",
        unit_amount: item.unit_price_cents,
        product_data: {
          name: `${item.product_name_snapshot} - ${item.variant_name_snapshot}`,
        },
      },
    }));

    let session;
    try {
      session = await startServerSpan(
        "checkout.create_stripe_session",
        {
          "checkout.total_cents": totalCents,
          "checkout.item_count": stripeLineItems.length,
        },
        () =>
          stripe.checkout.sessions.create({
            mode: "payment",
            client_reference_id: createdOrder.id,
            customer_email: customerEmail,
            line_items: stripeLineItems,
            success_url: `${checkoutBaseUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${checkoutBaseUrl}/afrekenen`,
            metadata: {
              order_id: createdOrder.id,
              order_number: createdOrder.order_number,
              fulfillment_type: fulfillmentType,
            },
          }),
      );
    } catch (stripeError) {
      console.error("Checkout create: Stripe session fout", stripeError);
      captureServerException(stripeError, {
        tags: {
          "checkout.step": "create_stripe_session",
          "checkout.fulfillment_type": fulfillmentType,
        },
        extras: {
          orderId: createdOrder.id,
          orderNumber: createdOrder.order_number,
          totalCents,
        },
      });
      return json(
        { error: "De betaling kon momenteel niet worden gestart." },
        500,
      );
    }
    console.log("Checkout create: Stripe session aangemaakt", {
      sessionId: session.id,
    });

    await startServerSpan(
      "checkout.link_stripe_session",
      {
        "checkout.order_id": createdOrder.id,
      },
      () =>
        supabase
          .from("orders")
          .update({
            stripe_checkout_session_id: session.id,
          })
          .eq("id", createdOrder.id),
    );
    console.log("Checkout create: order gekoppeld aan Stripe session");
    addServerBreadcrumb({
      category: "checkout",
      message: "Checkout session aangemaakt",
      data: {
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
        fulfillmentType,
      },
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("Checkout create fout:", error);
    captureServerException(error, {
      tags: {
        "checkout.step": "create",
      },
    });

    if (isLocalRequest(request.url)) {
      const message = error instanceof Error ? error.message : "Onbekende fout";
      return json({ error: message }, 500);
    }

    return json(
      { error: "Er ging iets mis bij het starten van de betaling." },
      500,
    );
  }
}
