type PaymentMethod = { value: string; available_for: string[] };

export function paymentForFulfillment(methods: PaymentMethod[], fulfillment: string, current: string): string {
  const available = methods.filter((method) => method.available_for.includes(fulfillment));
  return available.some((method) => method.value === current) ? current : available[0]?.value ?? "";
}

export function paymentProofError(proof: { mimeType?: string | null; fileSize?: number } | null): string | null {
  if (!proof) return "Choose payment proof before placing your order.";
  if (proof.mimeType && !["image/jpeg", "image/png", "image/webp"].includes(proof.mimeType)) return "Choose a JPEG, PNG, or WebP image.";
  if (proof.fileSize !== undefined && proof.fileSize > 5 * 1024 * 1024) return "Payment proof must be 5 MB or smaller.";
  return null;
}

export function formatCheckoutAmount(value: string): string {
  return `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
