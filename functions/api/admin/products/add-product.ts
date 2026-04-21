import { requireAdmin } from "../../../_lib/require-admin";
import { json } from "../../../_lib/security-headers";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const onRequestPost: PagesFunction = async (context) => {
  const result = await requireAdmin(context);

  if ("response" in result) {
    return result.response;
  }

  const { supabase } = result;

  try {
    const body = await context.request.json();

    const name = String(body.name || "").trim();
    const slugInput = String(body.slug || "").trim();
    const description = String(body.description || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const isActive = body.isActive !== false;

    const createFirstVariant = Boolean(body.createFirstVariant);
    const variantLabel = String(body.variantLabel || "").trim();
    const variantSize = String(body.variantSize || "").trim();
    const variantColor = String(body.variantColor || "zwart").trim();
    const variantIsKids = Boolean(body.variantIsKids);
    const variantIsActive = body.variantIsActive !== false;
    const variantStockQuantity = Number(body.variantStockQuantity);
    const variantPriceCents = Number(body.variantPriceCents);

    if (!name) {
      return json({ error: "Productnaam is verplicht." }, 400);
    }

    const slug = slugify(slugInput || name);

    if (!slug) {
      return json({ error: "Slug kon niet worden opgebouwd." }, 400);
    }

    const { data: existingProduct } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingProduct) {
      return json({ error: "Er bestaat al een product met deze slug." }, 400);
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        name,
        slug,
        description: description || null,
        image_url: imageUrl || null,
        is_active: isActive,
      })
      .select(
        `
        id,
        name,
        slug,
        description,
        image_url,
        is_active
      `,
      )
      .single();

    if (productError || !product) {
      return json(
        { error: productError?.message || "Kon product niet aanmaken." },
        500,
      );
    }

    if (imageUrl) {
      const { error: imageError } = await supabase
        .from("product_images")
        .insert({
          product_id: product.id,
          image_url: imageUrl,
          alt_text: name,
          sort_order: 0,
        });

      if (imageError) {
        return json({ error: imageError.message }, 500);
      }
    }

    if (createFirstVariant) {
      if (!variantLabel || !variantSize) {
        return json(
          { error: "Eerste variant: label en maat zijn verplicht." },
          400,
        );
      }

      if (!Number.isInteger(variantStockQuantity) || variantStockQuantity < 0) {
        return json(
          {
            error:
              "Eerste variant: stock moet een geheel getal van 0 of hoger zijn.",
          },
          400,
        );
      }

      if (!Number.isInteger(variantPriceCents) || variantPriceCents < 0) {
        return json(
          {
            error:
              "Eerste variant: prijs moet een geheel getal van 0 of hoger zijn.",
          },
          400,
        );
      }

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert({
          product_id: product.id,
          label: variantLabel,
          size: variantSize,
          color: variantColor || "zwart",
          is_kids: variantIsKids,
          is_active: variantIsActive,
          stock_quantity: variantStockQuantity,
          price_cents: variantPriceCents,
        });

      if (variantError) {
        return json({ error: variantError.message }, 500);
      }
    }

    return json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return json({ error: message }, 500);
  }
};
