import { requireAdmin } from "../../../require-admin";
import { json } from "../../../security-headers";

const allowedStatuses = new Set([
  "pending_payment",
  "paid",
  "ready_for_pickup",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export const onRequestPost: PagesFunction = async (context) => {
  const result = await requireAdmin(context);

  if ("response" in result) {
    return result.response;
  }

  const { supabase } = result;

  try {
    const body = await context.request.json();
    const orderId = String(body.orderId || "").trim();
    const status = String(body.status || "").trim();

    if (!orderId) {
      return json({ error: "Order ID ontbreekt." }, 400);
    }

    if (!allowedStatuses.has(status)) {
      return json({ error: "Ongeldige status." }, 400);
    }

    const updatePayload: Record<string, unknown> = {
      status,
    };

    if (status === "picked_up" || status === "delivered") {
      updatePayload.fulfilled_at = new Date().toISOString();
    } else {
      updatePayload.fulfilled_at = null;
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .select("id, status, fulfilled_at")
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ order: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return json({ error: message }, 500);
  }
};
