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
    const variantId = String(body.variantId || "").trim();

    if (!variantId) {
      return json({ error: "Variant ID ontbreekt." }, 400);
    }

    const { data, error } = await supabase
      .from("product_variants")
      .delete()
      .eq("id", variantId)
      .select("id")
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ deleted: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return json({ error: message }, 500);
  }
};
