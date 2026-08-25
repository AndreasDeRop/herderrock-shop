export const SOCK_BULK_MIN_QUANTITY = 3;
export const SOCK_BULK_PRICE_CENTS = 700;
export const DELIVERY_MIN_SUBTOTAL_CENTS = 1500;

type CartPricingItem = {
  productName: string;
  productSlug?: string | null;
  unitPriceCents: number;
  quantity: number;
};

export function normalizeCartMatchValue(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isSockProduct(
  productName: string | null | undefined,
  productSlug?: string | null,
) {
  const haystack = `${normalizeCartMatchValue(productName)} ${normalizeCartMatchValue(productSlug)}`;

  return ["kous", "kousen", "sok", "sokken", "sock", "socks"].some(
    (keyword) => haystack.includes(keyword),
  );
}

export function calculateCartPricing<T extends CartPricingItem>(items: T[]) {
  const sockQuantity = items.reduce((total, item) => {
    if (!isSockProduct(item.productName, item.productSlug)) {
      return total;
    }

    return total + item.quantity;
  }, 0);

  const qualifiesForSockDiscount = sockQuantity >= SOCK_BULK_MIN_QUANTITY;

  let subtotalCents = 0;

  const pricedItems = items.map((item) => {
    const isSock = isSockProduct(item.productName, item.productSlug);
    const effectiveUnitPriceCents =
      isSock && qualifiesForSockDiscount
        ? SOCK_BULK_PRICE_CENTS
        : item.unitPriceCents;
    const lineTotalCents = effectiveUnitPriceCents * item.quantity;

    subtotalCents += lineTotalCents;

    return {
      ...item,
      isSock,
      effectiveUnitPriceCents,
      lineTotalCents,
    };
  });

  return {
    pricedItems,
    subtotalCents,
    sockQuantity,
    qualifiesForSockDiscount,
  };
}
