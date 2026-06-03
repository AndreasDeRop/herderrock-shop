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
    const label = String(body.label || "").trim();
    const size = String(body.size || "").trim();
    const color = String(body.color || "zwart").trim();
    const isKids = Boolean(body.isKids);
    const isActive = body.isActive !== false;
    const stockQuantity = Number(body.stockQuantity);
    const priceCents = Number(body.priceCents);

    if (!productId) {
      return json({ error: "Product ID ontbreekt." }, 400);
    }

    if (!label || !size) {
      return json({ error: "Label en maat zijn verplicht." }, 400);
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return json(
        { error: "Stock moet een geheel getal van 0 of hoger zijn." },
        400,
      );
    }

    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return json(
        { error: "Prijs moet een geheel getal van 0 of hoger zijn." },
        400,
      );
    }

    const { data, error } = await supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        label,
        size,
        color,
        is_kids: isKids,
        is_active: isActive,
        stock_quantity: stockQuantity,
        price_cents: priceCents,
      })
      .select(
        `
        id,
        product_id,
        label,
        size,
        is_kids,
        color,
        price_cents,
        stock_quantity,
        is_active,
        created_at
      `,
      )
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
