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
    const imageId = String(body.imageId || "").trim();

    if (!imageId) {
      return json({ error: "Image ID ontbreekt." }, 400);
    }

    const { data, error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", imageId)
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
