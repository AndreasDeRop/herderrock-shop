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
    const isActive = Boolean(body.isActive);

    if (!variantId) {
      return json({ error: "Variant ID ontbreekt." }, 400);
    }

    const { data, error } = await supabase
      .from("product_variants")
      .update({
        is_active: isActive,
      })
      .eq("id", variantId)
      .select("id, is_active")
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
