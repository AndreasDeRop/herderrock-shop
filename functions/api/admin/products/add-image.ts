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
    const imageUrl = String(body.imageUrl || "").trim();
    const altText = String(body.altText || "").trim();
    const sortOrder = Number(body.sortOrder);

    if (!productId) {
      return json({ error: "Product ID ontbreekt." }, 400);
    }

    if (!imageUrl) {
      return json({ error: "Image URL ontbreekt." }, 400);
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return json(
        { error: "Sort order moet een geheel getal van 0 of hoger zijn." },
        400,
      );
    }

    const { data, error } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        image_url: imageUrl,
        alt_text: altText || null,
        sort_order: sortOrder,
      })
      .select(
        `
        id,
        product_id,
        image_url,
        alt_text,
        sort_order
      `,
      )
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
