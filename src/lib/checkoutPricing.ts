export type PromoCodeDefinition = {
  code: string;
  label: string;
  type: "percent" | "flat" | "shipping";
  value: number;
  cap?: number;
};

export const FREE_SHIPPING_THRESHOLD = 5000;
export const STANDARD_SHIPPING_FEE = 150;

export const PROMO_CODES: PromoCodeDefinition[] = [
  { code: "BATTLEFRONT10", label: "Battlefront 10", type: "percent", value: 10, cap: 500 },
  { code: "SAVE150", label: "Save ₱150", type: "flat", value: 150 },
  { code: "FREESHIP", label: "Free shipping", type: "shipping", value: 0 },
];

export type CheckoutPricing = {
  productDiscount: number;
  shippingDiscount: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  promoLabel: string;
};

export function calculateCheckoutPricing(
  subtotal: number,
  promoCode = "",
  deliveryMethod: "standard" | "pickup" = "standard",
): CheckoutPricing {
  const match = PROMO_CODES.find((promo) => promo.code === promoCode.trim().toUpperCase());
  const baseShippingFee = deliveryMethod === "pickup" || subtotal >= FREE_SHIPPING_THRESHOLD
    ? 0
    : STANDARD_SHIPPING_FEE;

  let productDiscount = 0;
  let shippingDiscount = 0;

  if (match?.type === "percent") {
    const discount = (subtotal * match.value) / 100;
    productDiscount = match.cap === undefined ? discount : Math.min(discount, match.cap);
  } else if (match?.type === "flat") {
    productDiscount = Math.min(match.value, subtotal);
  } else if (match?.type === "shipping") {
    shippingDiscount = baseShippingFee;
  }

  const shippingFee = baseShippingFee - shippingDiscount;
  const discountAmount = productDiscount + shippingDiscount;

  return {
    productDiscount,
    shippingDiscount,
    discountAmount,
    shippingFee,
    total: Math.max(0, subtotal - productDiscount) + shippingFee,
    promoLabel: match?.label ?? "",
  };
}