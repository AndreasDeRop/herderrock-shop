import { createSupabaseAdmin } from "./supabase-admin";
import { json } from "./security-headers";
import { createStripe } from "./stripe";

type CartItem = {
  variantId: string;
  quantity: number;
};

export type ServerEnv = Record<string, string | undefined>;

const postalCodeVillages: Record<string, string[]> = {
  "9300": ["Aalst"],
  "9308": ["Gijzegem", "Hofstade"],
  "9310": ["Herdersem", "Moorsel", "Baardegem", "Meldert"],
  "9320": ["Erembodegem", "Nieuwerkerken"],
};

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
    const body = await request.json();

    if (!env.SHOP_CLOSES_AT) {
      return json({ error: "SHOP_CLOSES_AT ontbreekt op de server." }, 500);
    }

    if (!env.SITE_URL) {
      return json({ error: "SITE_URL ontbreekt op de server." }, 500);
    }

    const closeAt = new Date(env.SHOP_CLOSES_AT);
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

      const validVillages = postalCodeVillages[postalCode] || [];
      if (!validVillages.includes(city)) {
        return json({ error: "Ongeldige postcode of deelgemeente." }, 400);
      }
    }

    const supabase = createSupabaseAdmin(env);
    const stripe = createStripe(env);

    const variantIds = cart.map((item) => item.variantId);
    const { data: variants, error: variantsError } = await supabase
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
      .in("id", variantIds);

    if (variantsError) {
      return json(
        { error: "Kon productinformatie momenteel niet ophalen." },
        500,
      );
    }

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
      const { data: pickupSlot, error: pickupError } = await supabase
        .from("pickup_slots")
        .select("id, is_active")
        .eq("id", pickupSlotId)
        .single();

      if (pickupError || !pickupSlot?.is_active) {
        return json({ error: "Ongeldig afhaalmoment." }, 400);
      }
    }

    if (fulfillmentType === "delivery" && postalCode) {
      const { data: deliveryZone, error: deliveryError } = await supabase
        .from("delivery_zones")
        .select("postal_code, delivery_fee_cents, is_active")
        .eq("postal_code", postalCode)
        .single();

      if (deliveryError || !deliveryZone?.is_active) {
        return json(
          { error: "Levering is niet beschikbaar voor deze postcode." },
          400,
        );
      }

      deliveryFeeCents = deliveryZone.delivery_fee_cents;
    }

    const totalCents = subtotalCents + deliveryFeeCents;
    const orderNumber = createOrderNumber();

    const { data: createdOrder, error: orderError } = await supabase
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
      .single();

    if (orderError || !createdOrder) {
      return json({ error: "Kon bestelling momenteel niet aanmaken." }, 500);
    }

    const orderItemsPayload = normalizedItems.map((item) => ({
      order_id: createdOrder.id,
      ...item,
    }));

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (orderItemsError) {
      return json(
        { error: "Kon bestelling momenteel niet volledig opslaan." },
        500,
      );
    }

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

    if (deliveryFeeCents > 0) {
      stripeLineItems.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: deliveryFeeCents,
          product_data: {
            name: "Levering regio Groot-Aalst",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: createdOrder.id,
      customer_email: customerEmail,
      line_items: stripeLineItems,
      success_url: `${env.SITE_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.SITE_URL}/afrekenen`,
      metadata: {
        order_id: createdOrder.id,
        order_number: createdOrder.order_number,
        fulfillment_type: fulfillmentType,
      },
    });

    await supabase
      .from("orders")
      .update({
        stripe_checkout_session_id: session.id,
      })
      .eq("id", createdOrder.id);

    return json({ url: session.url });
  } catch (error) {
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
