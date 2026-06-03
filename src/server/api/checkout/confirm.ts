import { createSupabaseAdmin } from "../../supabase-admin";
import { json } from "../../security-headers";
import { createStripe } from "../../stripe";
import { syncPaidOrderFromSession } from "../../sync-paid-order";

export const onRequestPost = async (context: {
  request: Request;
  env: Record<string, string | undefined>;
}) => {
  const { request, env } = context;
  console.log("Checkout confirm: request ontvangen");

  try {
    const body = await request.json();
    const sessionId = String(body.sessionId || "").trim();

    if (!sessionId) {
      return json({ error: "Missing sessionId." }, 400);
    }

    const stripe = createStripe(env);
    const supabase = createSupabaseAdmin(env);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("Checkout confirm: Stripe session opgehaald", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
    });

    if (session.payment_status !== "paid") {
      return json({
        confirmed: false,
        skipped: "session not paid",
        paymentStatus: session.payment_status,
      });
    }

    const result = await syncPaidOrderFromSession({
      supabase,
      env,
      session,
      source: "success-page",
    });

    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }

    if ("skipped" in result) {
      return json({ confirmed: true, skipped: result.skipped });
    }

    return json({ confirmed: true, orderId: result.orderId });
  } catch (error) {
    console.error("Checkout confirm fout", error);
    return json(
      { error: "Er ging iets mis bij het bevestigen van de betaling." },
      500,
    );
  }
};
