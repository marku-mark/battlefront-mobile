export function shouldRefreshOnlineOrder(order: { statusValue: string; paymentStatusValue?: string; paymentMethod?: string; payment: { checkout_url?: string | null; hosted_payment_method?: string | null; qr_code_image_url?: string | null; can_retry?: boolean; can_retry_hosted?: boolean } } | null): boolean {
  if (!order || order.statusValue === "cancelled" || order.statusValue === "completed") return false;
  if (["paid", "refunded", "failed", "expired", "rejected"].includes(order.paymentStatusValue ?? "")) return false;
  return Boolean(order.payment.checkout_url || order.payment.hosted_payment_method || order.payment.qr_code_image_url || order.payment.can_retry || order.payment.can_retry_hosted || order.paymentMethod?.toLowerCase().includes("online"));
}
