import { requireAdmin } from "../../../_lib/require-admin";
import { json } from "../../../_lib/security-headers";

export const onRequestPost: PagesFunction = async (context) => {
  const result = await requireAdmin(context);

  if ("response" in result) {
    return result.response;
  }

  const { supabase } = result;

  try {
    const body = await context.request.json();

    const productId = String(body.productId || "").trim();
    const isActive = Boolean(body.isActive);

    if (!productId) {
      return json({ error: "Product ID ontbreekt." }, 400);
    }

    const { data, error } = await supabase
      .from("products")
      .update({
        is_active: isActive,
      })
      .eq("id", productId)
      .select("id, is_active")
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ product: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return json({ error: message }, 500);
  }
};
