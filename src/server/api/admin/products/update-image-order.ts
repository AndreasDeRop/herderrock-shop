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

    const imageId = String(body.imageId || "").trim();
    const sortOrder = Number(body.sortOrder);

    if (!imageId) {
      return json({ error: "Image ID ontbreekt." }, 400);
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return json(
        { error: "Sort order moet een geheel getal van 0 of hoger zijn." },
        400,
      );
    }

    const { data, error } = await supabase
      .from("product_images")
      .update({
        sort_order: sortOrder,
      })
      .eq("id", imageId)
      .select("id, sort_order")
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ image: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return json({ error: message }, 500);
  }
};
