type PaymentMethod = { value: string; available_for: string[] };

export function checkoutRecipient(customer: { name: string; default_delivery_address?: string | null }, addresses: { recipient: string; phone: string; address: string }[]) {
  const saved = addresses.find((entry) => entry.address === customer.default_delivery_address) ?? addresses[0];
  return {
    name: saved?.recipient || customer.name,
    phone: saved?.phone ?? "",
    address: saved?.address || customer.default_delivery_address || "",
  };
}

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

export function checkoutDetailsError(details: { name: string; phone: string; fulfillment: string; address: string; editingAddress: boolean; requiresProof: boolean; hasProof: boolean }): string | null {
  if (!details.name.trim()) return "Enter the recipient name.";
  if (!details.phone.trim()) return "Enter a contact number.";
  if (details.fulfillment === "delivery" && (details.editingAddress || !details.address.trim())) return "Save a complete delivery address before placing your order.";
  if (details.requiresProof && !details.hasProof) return "Choose payment proof before placing your order.";
  return null;
}
