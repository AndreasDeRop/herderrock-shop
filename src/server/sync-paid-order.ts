import { sendEmail } from "./email";
import { buildOrderConfirmationEmail } from "./order-confirmation-email";
import Stripe from "stripe";
import {
  addServerBreadcrumb,
  captureServerException,
  startServerSpan,
} from "./sentry";

export async function syncPaidOrderFromSession({
  supabase,
  env,
  session,
  source,
}: {
  supabase: any;
  env: Record<string, string | undefined>;
  session: Stripe.Checkout.Session;
  source: "webhook" | "success-page";
}) {
  const orderId = session.client_reference_id;

  if (!orderId) {
    console.warn(`Stripe ${source}: missing client_reference_id`, {
      sessionId: session.id,
    });
    return { ok: true, skipped: "missing client_reference_id" } as const;
  }

  const { data: order, error: orderError } = await startServerSpan(
    "payments.lookup_order",
    {
      "payments.source": source,
    },
    () =>
      supabase
        .from("orders")
        .select("id, status")
        .eq("id", orderId)
        .single(),
  );

  if (orderError || !order) {
    if (orderError) {
      console.error(`Stripe ${source}: order lookup fout`, orderError);
    }
    return { ok: true, skipped: "order not found" } as const;
  }

  if (order.status === "paid") {
    console.log(`Stripe ${source}: order al betaald`, { orderId });
    return { ok: true, skipped: "already paid" } as const;
  }

  const { data: orderItems, error: orderItemsError } = await startServerSpan(
    "payments.lookup_order_items",
    {
      "payments.source": source,
    },
    () =>
      supabase
        .from("order_items")
        .select("variant_id, quantity")
        .eq("order_id", orderId),
  );

  if (orderItemsError) {
    console.error(`Stripe ${source}: order items query fout`, orderItemsError);
    captureServerException(orderItemsError, {
      tags: {
        "payments.step": "lookup_order_items",
        "payments.source": source,
      },
      extras: {
        orderId,
        sessionId: session.id,
      },
    });
    return { ok: false, status: 500, error: orderItemsError.message } as const;
  }

  for (const item of orderItems || []) {
    const { data, error } = await startServerSpan(
      "payments.decrement_stock",
      {
        "payments.source": source,
      },
      () =>
        supabase.rpc("decrement_variant_stock", {
          p_variant_id: item.variant_id,
          p_qty: item.quantity,
        }),
    );

    if (error) {
      console.error(`Stripe ${source}: stock decrement fout`, error);
      captureServerException(error, {
        tags: {
          "payments.step": "decrement_stock",
          "payments.source": source,
        },
        extras: {
          orderId,
          sessionId: session.id,
          variantId: item.variant_id,
          quantity: item.quantity,
        },
      });
      return { ok: false, status: 500, error: error.message } as const;
    }

    if (data !== true) {
      console.error(`Stripe ${source}: stock decrement geweigerd`, {
        orderId,
        variantId: item.variant_id,
        quantity: item.quantity,
      });
      return {
        ok: false,
        status: 409,
        error: "Voorraad ontoereikend tijdens betalingsverwerking.",
      } as const;
    }
  }

  const { error: updateError } = await startServerSpan(
    "payments.mark_order_paid",
    {
      "payments.source": source,
    },
    () =>
      supabase
        .from("orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_checkout_session_id: session.id,
        })
        .eq("id", orderId),
  );

  if (updateError) {
    console.error(`Stripe ${source}: order update fout`, updateError);
    captureServerException(updateError, {
      tags: {
        "payments.step": "mark_order_paid",
        "payments.source": source,
      },
      extras: {
        orderId,
        sessionId: session.id,
      },
    });
    return { ok: false, status: 500, error: updateError.message } as const;
  }

  console.log(`Stripe ${source}: order op paid gezet`, {
    orderId,
    sessionId: session.id,
  });
  addServerBreadcrumb({
    category: "payments",
    message: "Order gemarkeerd als betaald",
    data: {
      orderId,
      sessionId: session.id,
      source,
    },
  });

  try {
    const { data: confirmationOrder, error: confirmationOrderError } =
      await startServerSpan(
        "payments.load_confirmation_email_data",
        {
          "payments.source": source,
        },
        () =>
          supabase
            .from("orders")
            .select(
              `
              order_number,
              customer_name,
              customer_email,
              fulfillment_type,
              address_line1,
              postal_code,
              city,
              subtotal_cents,
              delivery_fee_cents,
              total_cents,
              pickup_slot:pickup_slots (
                label,
                pickup_date,
                pickup_time
              ),
              items:order_items (
                product_name_snapshot,
                variant_name_snapshot,
                quantity,
                line_total_cents
              )
            `,
            )
            .eq("id", orderId)
            .single(),
      );

    if (confirmationOrderError || !confirmationOrder) {
      if (confirmationOrderError) {
        throw confirmationOrderError;
      }
      throw new Error("Order confirmation data ontbreekt.");
    }

    const email = buildOrderConfirmationEmail({
      orderNumber: confirmationOrder.order_number,
      customerName: confirmationOrder.customer_name,
      customerEmail: confirmationOrder.customer_email,
      fulfillmentType: confirmationOrder.fulfillment_type,
      pickupLabel: confirmationOrder.pickup_slot?.label,
      pickupDate: confirmationOrder.pickup_slot?.pickup_date,
      pickupTime: confirmationOrder.pickup_slot?.pickup_time,
      addressLine1: confirmationOrder.address_line1,
      postalCode: confirmationOrder.postal_code,
      city: confirmationOrder.city,
      subtotalCents: confirmationOrder.subtotal_cents,
      deliveryFeeCents: confirmationOrder.delivery_fee_cents,
      totalCents: confirmationOrder.total_cents,
      items: (confirmationOrder.items || []).map((item: any) => ({
        productName: item.product_name_snapshot,
        variantName: item.variant_name_snapshot,
        quantity: item.quantity,
        lineTotalCents: item.line_total_cents,
      })),
    });

    const emailResult = await startServerSpan(
      "payments.send_confirmation_email",
      {
        "payments.source": source,
      },
      () =>
        sendEmail({
          env,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          idempotencyKey: `order-confirmation-${orderId}`,
          tags: [
            {
              name: "order_id",
              value: orderId,
            },
            {
              name: "source",
              value: source,
            },
          ],
        }),
    );

    addServerBreadcrumb({
      category: "email",
      message: emailResult.sent
        ? "Bestelbevestiging verzonden"
        : "Bestelbevestiging overgeslagen",
      data: {
        orderId,
        source,
        sent: emailResult.sent,
        skipped: "skipped" in emailResult ? emailResult.skipped : undefined,
      },
      level: emailResult.sent ? "info" : "warning",
    });
  } catch (emailError) {
    console.error(`Stripe ${source}: bevestigingsmail fout`, emailError);
    captureServerException(emailError, {
      tags: {
        "payments.step": "send_confirmation_email",
        "payments.source": source,
      },
      extras: {
        orderId,
        sessionId: session.id,
      },
    });
  }

  return { ok: true, orderId } as const;
}
