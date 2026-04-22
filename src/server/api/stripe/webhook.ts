import Stripe from "stripe";
import { createSupabaseAdmin } from "../../supabase-admin";
import { json } from "../../security-headers";
import { createStripe, stripeCryptoProvider } from "../../stripe";

export const onRequestPost = async (context: {
  request: Request;
  env: Record<string, string | undefined>;
}) => {
  const { request, env } = context;
  const stripe = createStripe(env);
  const supabase = createSupabaseAdmin(env);

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "Missing Stripe-Signature header." }, 400);
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      stripeCryptoProvider,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook signature invalid.";
    return json({ error: message }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.client_reference_id;

    if (!orderId) {
      return json({ received: true, skipped: "missing client_reference_id" });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return json({ received: true, skipped: "order not found" });
    }

    if (order.status === "paid") {
      return json({ received: true, skipped: "already paid" });
    }

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select("variant_id, quantity")
      .eq("order_id", orderId);

    if (orderItemsError) {
      return json({ error: orderItemsError.message }, 500);
    }

    for (const item of orderItems || []) {
      const { data, error } = await supabase.rpc("decrement_variant_stock", {
        p_variant_id: item.variant_id,
        p_qty: item.quantity,
      });

      if (error) {
        return json({ error: error.message }, 500);
      }

      if (data !== true) {
        return json(
          { error: "Voorraad ontoereikend tijdens webhook-verwerking." },
          409,
        );
      }
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
      })
      .eq("id", orderId);

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }
  }

  return json({ received: true });
};
