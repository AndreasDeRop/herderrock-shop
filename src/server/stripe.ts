import { env as cloudflareEnv } from "cloudflare:workers";
import Stripe from "stripe";

export function createStripe(env: Record<string, string | undefined>) {
  const stripeSecretKey =
    env.STRIPE_SECRET_KEY ??
    cloudflareEnv.STRIPE_SECRET_KEY ??
    process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("Stripe secret ontbreekt in alle runtime bronnen", {
      handlerEnv: Boolean(env.STRIPE_SECRET_KEY),
      cloudflareEnv: Boolean(cloudflareEnv.STRIPE_SECRET_KEY),
      processEnv: Boolean(process.env.STRIPE_SECRET_KEY),
    });
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(stripeSecretKey);
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
