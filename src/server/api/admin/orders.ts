import { requireAdmin } from "../../require-admin";
import { json } from "../../security-headers";

export const onRequestGet: PagesFunction = async (context) => {
  const result = await requireAdmin(context);

  if ("response" in result) {
    return result.response;
  }

  const { supabase } = result;

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      order_number,
      status,
      fulfillment_type,
      customer_name,
      customer_email,
      customer_phone,
      address_line1,
      postal_code,
      city,
      subtotal_cents,
      delivery_fee_cents,
      total_cents,
      paid_at,
      fulfilled_at,
      pickup_slot:pickup_slots (
        label,
        pickup_date,
        pickup_time
      ),
      items:order_items (
        id,
        product_name_snapshot,
        variant_name_snapshot,
        unit_price_cents,
        quantity,
        line_total_cents
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    return json({ error: error.message }, 500);
  }

  const orders = (data || []).map((order: any) => ({
    ...order,
    fulfillment_label:
      order.fulfillment_type === "pickup"
        ? order.pickup_slot?.label || "Afhalen"
        : [order.address_line1, order.postal_code, order.city]
            .filter(Boolean)
            .join(", "),
  }));

  return json({ orders });
};
