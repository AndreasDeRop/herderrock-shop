import Stripe from "stripe";

export function createStripe(env: Record<string, string | undefined>) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
