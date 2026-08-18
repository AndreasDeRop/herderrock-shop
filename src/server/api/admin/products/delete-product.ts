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
    const productId = String(body.productId || "").trim();

    if (!productId) {
      return json({ error: "Product ID ontbreekt." }, 400);
    }

    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId);

    if (variantsError) {
      return json({ error: variantsError.message }, 500);
    }

    const variantIds = (variants ?? []).map((variant) => variant.id);

    if (variantIds.length > 0) {
      const { count, error: orderItemsError } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .in("variant_id", variantIds);

      if (orderItemsError) {
        return json({ error: orderItemsError.message }, 500);
      }

      if ((count ?? 0) > 0) {
        return json(
          {
            error:
              "Dit product kan niet verwijderd worden omdat het al in bestellingen voorkomt.",
          },
          400,
        );
      }
    }

    const { error: imagesError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);

    if (imagesError) {
      return json({ error: imagesError.message }, 500);
    }

    const { error: deleteVariantsError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId);

    if (deleteVariantsError) {
      return json({ error: deleteVariantsError.message }, 500);
    }

    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .select("id, name")
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
