import { getDeliveryZones, getPickupSlots, formatPrice } from "./shop";

export type FulfillmentType = "pickup" | "delivery";

export async function getCheckoutData() {
  const [pickupSlots, deliveryZones] = await Promise.all([
    getPickupSlots(),
    getDeliveryZones(),
  ]);

  return {
    pickupSlots,
    deliveryZones,
  };
}

export function isAllowedPostalCode(
  postalCode: string,
  allowedPostalCodes: string[],
) {
  return allowedPostalCodes.includes(postalCode.trim());
}

export function formatDeliveryFee(cents: number) {
  return formatPrice(cents);
}
