import { env as cloudflareEnv } from "cloudflare:workers";
import Stripe from "stripe";
import { createSupabaseAdmin } from "../../supabase-admin";
import { json } from "../../security-headers";
import { createStripe, stripeCryptoProvider } from "../../stripe";
import { syncPaidOrderFromSession } from "../../sync-paid-order";

export const onRequestPost = async (context: {
  request: Request;
  env: Record<string, string | undefined>;
}) => {
  const { request, env } = context;
  console.log("Stripe webhook: request ontvangen");
  const stripe = createStripe(env);
  const supabase = createSupabaseAdmin(env);
  const webhookSecret =
    env.STRIPE_WEBHOOK_SECRET ??
    cloudflareEnv.STRIPE_WEBHOOK_SECRET ??
    process.env.STRIPE_WEBHOOK_SECRET;

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("Stripe webhook: missing Stripe-Signature header");
    return json({ error: "Missing Stripe-Signature header." }, 400);
  }

  if (!webhookSecret) {
    console.error("Stripe webhook: missing STRIPE_WEBHOOK_SECRET", {
      handlerEnv: Boolean(env.STRIPE_WEBHOOK_SECRET),
      cloudflareEnv: Boolean(cloudflareEnv.STRIPE_WEBHOOK_SECRET),
      processEnv: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    });
    return json({ error: "Missing STRIPE_WEBHOOK_SECRET." }, 500);
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      stripeCryptoProvider,
    );
  } catch (error) {
    console.error("Stripe webhook: signature verificatie mislukt", error);
    const message =
      error instanceof Error ? error.message : "Webhook signature invalid.";
    return json({ error: message }, 400);
  }
  console.log("Stripe webhook: event gevalideerd", { type: event.type });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const result = await syncPaidOrderFromSession({
      supabase,
      env,
      session,
      source: "webhook",
    });

    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }

    if ("skipped" in result) {
      return json({ received: true, skipped: result.skipped });
    }
  }

  return json({ received: true });
};
