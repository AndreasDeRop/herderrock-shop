import { requireAdmin } from "../../require-admin";
import { json } from "../../security-headers";
import { normalizeProductImageUrl } from "../../../lib/image-url";

export const onRequestGet: PagesFunction = async (context) => {
  const result = await requireAdmin(context);

  if ("response" in result) {
    return result.response;
  }

  const { supabase } = result;

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      slug,
      description,
      image_url,
      is_active,
      images:product_images (
        id,
        image_url,
        alt_text,
        sort_order
      ),
      variants:product_variants (
        id,
        label,
        size,
        is_kids,
        color,
        price_cents,
        stock_quantity,
        is_active,
        created_at
      )
    `,
    )
    .order("created_at", { ascending: true });

  if (error) {
    return json({ error: error.message }, 500);
  }

  const products = (data || []).map((product: any) => ({
    ...product,
    image_url: normalizeProductImageUrl(product.image_url),
    images: [...(product.images || [])]
      .map((image) => ({
        ...image,
        image_url:
          normalizeProductImageUrl(image.image_url) ||
          "/images/tshirt-placeholder.jpg",
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
    variants: [...(product.variants || [])].sort((a, b) => {
      const aSize = a.size || "";
      const bSize = b.size || "";
      return aSize.localeCompare(bSize);
    }),
  }));

  return json({ products });
};
