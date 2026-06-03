import { supabase } from "./supabase";

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  label: string;
  size: string;
  is_kids: boolean;
  color: string;
  price_cents: number;
  stock_quantity: number;
  is_active: boolean;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  variants?: ProductVariant[];
  images?: ProductImage[];
};

export type PickupSlot = {
  id: string;
  label: string;
  pickup_date: string;
  pickup_time: string;
  max_orders: number;
  is_active: boolean;
};

export type DeliveryZone = {
  id: string;
  postal_code: string;
  city: string | null;
  delivery_fee_cents: number;
  is_active: boolean;
};

export function isShopClosed() {
  const closeAt = new Date(import.meta.env.SHOP_CLOSES_AT);
  return new Date() > closeAt;
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export async function getActiveProducts(): Promise<Product[]> {
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
      variants:product_variants (
        id,
        product_id,
        label,
        size,
        is_kids,
        color,
        price_cents,
        stock_quantity,
        is_active
      ),
      images:product_images (
        id,
        product_id,
        image_url,
        alt_text,
        sort_order
      )
    `,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Kon producten niet ophalen: ${error.message}`);
  }

  return (data ?? []).map((product: any) => ({
    ...product,
    variants: (product.variants ?? []).filter(
      (v: ProductVariant) => v.is_active,
    ),
    images: [...(product.images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
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
      variants:product_variants (
        id,
        product_id,
        label,
        size,
        is_kids,
        color,
        price_cents,
        stock_quantity,
        is_active
      ),
      images:product_images (
        id,
        product_id,
        image_url,
        alt_text,
        sort_order
      )
    `,
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Kon product niet ophalen: ${error.message}`);
  }

  return {
    ...data,
    variants: (data.variants ?? []).filter((v: ProductVariant) => v.is_active),
    images: [...(data.images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}

export async function getPickupSlots(): Promise<PickupSlot[]> {
  const { data, error } = await supabase
    .from("pickup_slots")
    .select("*")
    .eq("is_active", true)
    .order("pickup_date", { ascending: true });

  if (error) {
    throw new Error(`Kon afhaalmomenten niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("is_active", true)
    .order("postal_code", { ascending: true });

  if (error) {
    throw new Error(`Kon leverzones niet ophalen: ${error.message}`);
  }

  return data ?? [];
}
export type PostalCodeVillages = Record<string, string[]>;

const splitDeliveryCities = (city: string | null | undefined) =>
  String(city ?? "")
    .split(/\s*[,;/]\s*/g)
    .map((value) => value.trim())
    .filter(Boolean);

const normalizeDeliveryValue = (value: string) =>
  value.trim().toLocaleLowerCase("nl-BE");

export function getPostalCodeVillages(
  deliveryZones: DeliveryZone[],
): PostalCodeVillages {
  const postalCodeVillages = deliveryZones.reduce((map, zone) => {
    const postalCode = String(zone.postal_code).trim();
    const cities = splitDeliveryCities(zone.city);

    if (!postalCode) {
      return map;
    }

    if (!map.has(postalCode)) {
      map.set(postalCode, []);
    }

    const villages = map.get(postalCode);

    for (const city of cities) {
      if (villages && !villages.includes(city)) {
        villages.push(city);
      }
    }

    return map;
  }, new Map<string, string[]>());

  const result = Object.fromEntries(postalCodeVillages);

  for (const villages of Object.values(result)) {
    villages.sort((a, b) => a.localeCompare(b, "nl-BE"));
  }

  return result;
}

export function getAllowedPostalCodes(deliveryZones: DeliveryZone[]) {
  return Object.keys(getPostalCodeVillages(deliveryZones)).sort((a, b) =>
    a.localeCompare(b, "nl-BE", { numeric: true }),
  );
}

export function getMatchingDeliveryZone(
  deliveryZones: DeliveryZone[],
  postalCode: string,
  city: string,
): DeliveryZone | null {
  const normalizedPostalCode = String(postalCode).trim();
  const normalizedCity = normalizeDeliveryValue(city);

  return (
    deliveryZones.find((zone) => {
      const zonePostalCode = String(zone.postal_code).trim();

      if (zonePostalCode !== normalizedPostalCode) {
        return false;
      }

      const cities = splitDeliveryCities(zone.city).map((value) =>
        normalizeDeliveryValue(value),
      );

      return cities.includes(normalizedCity);
    }) ?? null
  );
}
