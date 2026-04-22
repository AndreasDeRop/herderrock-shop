import { requireAdmin } from "../../../require-admin";
import { json } from "../../../security-headers";

export const onRequestPost: PagesFunction = async (context) => {
  const result = await requireAdmin(context);

  if ("response" in result) {
    return result.response;
  }

  const { supabase } = result;

  try {
    const body = await context.request.json();

    const variantId = String(body.variantId || "").trim();
    const stockQuantity = Number(body.stockQuantity);

    if (!variantId) {
      return json({ error: "Variant ID ontbreekt." }, 400);
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return json(
        { error: "Stock moet een geheel getal van 0 of hoger zijn." },
        400,
      );
    }

    const { data, error } = await supabase
      .from("product_variants")
      .update({
        stock_quantity: stockQuantity,
      })
      .eq("id", variantId)
      .select("id, stock_quantity")
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ variant: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return json({ error: message }, 500);
  }
};
