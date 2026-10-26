import { createReadCache } from "./readCache";
import { apiRequest, ApiError, invalidateCatalog, onSessionChange, getSessionRevision } from "./api";
import type { Page } from "./apiClient";
import { createProgressiveCatalog } from "./catalogCache";
import { Platform } from "react-native";
import { File } from "expo-file-system";
import { createOrderSubmission, type OrderInput } from "./orderSubmission";
export type { OrderInput } from "./orderSubmission";
export type OrderProductLine = { orderItemId?: number; productId: string; productName?: string; quantity: number; remainingReturnable?: number; canRequestReturn?: boolean; variant: string | null };
export type OrderRecord = { id: string; reference: string; date: string; status: string; statusValue: string; items: string; total: string; address?: string; phone?: string; deliveryMethod?: string; paymentMethod?: string; paymentStatus?: string; paymentStatusValue?: string; paymentRejection?: { reason: string; note?: string | null } | null; productSubtotal?: string; deliveryFee?: string; deliveryQuote?: BackendOrder["delivery_quote"]; shipment?: BackendOrder["shipment"]; productLines?: OrderProductLine[]; canCancel: boolean; canRequestCancellation: boolean; cancellation?: BackendOrder["cancellation"]; returnRequests: NonNullable<BackendOrder["return_requests"]>; returnReasonOptions: { value: string; label: string }[]; canRequestReturn: boolean; returnInstructions?: BackendOrder["return_instructions"]; returnEligibility?: BackendOrder["return_eligibility"]; refundPayments: NonNullable<BackendOrder["refund_payments"]>; payment: BackendOrder["payment"]; canResubmitProof: boolean; paymentNotice?: string };
type BackendOrder = { id: number; reference: string; created_at: string; status: { value: string; label: string }; can_cancel?: boolean; can_request_cancellation?: boolean; can_request_return?: boolean; cancellation?: { status?: { label?: string }; customer_note?: string | null; notice?: string } | null; return_requests?: { id: number; status?: { value?: string; label?: string }; order_item_id: number; quantity: number; product?: { id: number; name: string }; reason?: string; reason_label?: string; feedback?: string | null; can_withdraw?: boolean; refund?: { approved_amount?: string; verified_paid_amount?: string; remaining_amount?: string; payments?: { id: number; amount: string; payment_method: string; proof?: { id: number; url: string } | null }[] } | null }[]; return_reason_options?: Record<string, string>; return_instructions?: { label: string; branch: { name: string; city: string; address: string; contact_number: string | null } | null; message: string }; return_eligibility?: { received_at: string | null; deadline_at: string | null; window_days: number; window_approved: boolean; deadline_passed: boolean; timezone: string }; refund_payments?: { id: number; amount?: string; payment_method?: string; paid_at?: string; proof?: { id: number; url: string } | null }[]; fulfillment: { label: string; delivery_address?: string | null; delivery_destination?: string | null }; payment: { method: { label: string; value?: string }; status?: { value: string; label: string }; rejection?: { reason: string; note: string | null } | null; notice?: string; can_resubmit_proof?: boolean; checkout_url?: string | null; can_retry_hosted?: boolean; qr_code_image_url?: string | null; qr_expires_at?: string | null; qr_can_retry?: boolean; can_retry?: boolean; hosted_payment_method?: string | null }; recipient?: { contact_number: string }; product_subtotal?: string; delivery_fee?: string; delivery_quote?: { carrier: string; destination: string; packing_expectation: string; eta_min_days: number; eta_max_days: number; notice: string; is_demo: boolean; assumption_label?: string | null } | null; shipment?: { carrier: string; status: { value: string; label: string }; tracking_reference: string | null; eta: { estimated_delivery_start: string | null; estimated_delivery_end: string | null; notice: string }; timeline: { status: string; label: string; occurred_at: string }[]; notice: string; history_notice: string | null } | null; total: string; total_quantity: number; items?: { id?: number; product: { id: number; name: string }; quantity: number; unit_price?: string; remaining_returnable?: number; can_request?: boolean }[] };
function mapOrder(row: BackendOrder): OrderRecord {
  return { id: String(row.id), reference: row.reference, date: new Date(row.created_at).toLocaleDateString("en-PH"), status: row.status.label, statusValue: row.status.value,
    items: row.items?.map((item) => `${item.quantity} × ${item.product.name}`).join(", ") ?? `${row.total_quantity} item(s)`,
    total: `₱${Number(row.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, address: row.fulfillment.delivery_address ?? undefined, phone: row.recipient?.contact_number,
    deliveryMethod: row.fulfillment.label, paymentMethod: row.payment.method.label,
    productLines: row.items?.map((item) => ({ orderItemId: item.id, productId: String(item.product.id), productName: item.product.name, quantity: item.quantity, remainingReturnable: item.remaining_returnable, canRequestReturn: item.can_request, variant: null })),
    paymentStatus: row.payment.status?.label, paymentStatusValue: row.payment.status?.value, paymentRejection: row.payment.rejection, productSubtotal: row.product_subtotal, deliveryFee: row.delivery_fee, deliveryQuote: row.delivery_quote, shipment: row.shipment,
    canCancel: row.can_cancel ?? false, canRequestCancellation: row.can_request_cancellation ?? false, cancellation: row.cancellation, returnRequests: row.return_requests ?? [], returnReasonOptions: Object.entries(row.return_reason_options ?? {}).map(([value, label]) => ({ value, label })), canRequestReturn: row.can_request_return ?? false, returnInstructions: row.return_instructions, returnEligibility: row.return_eligibility, refundPayments: row.refund_payments ?? [], payment: row.payment, canResubmitProof: row.payment.can_resubmit_proof ?? false, paymentNotice: row.payment.notice };
}
const orderCache = createReadCache<OrderRecord | null>(30_000);
const ordersCache = createProgressiveCatalog(async (page) => {
  const revision = getSessionRevision();
  const result = await apiRequest<Page<BackendOrder>>(`orders?page=${page}`);
  if (revision !== getSessionRevision()) throw new Error("Your account changed. Reopen orders.");
  return { ...result, data: result.data.map(mapOrder) };
}, 30_000);
function clearOrders() { ordersCache.invalidate(true); orderCache.clear(); }
onSessionChange(clearOrders);
export function getOrdersSnapshot() { const snapshot = ordersCache.snapshot(); return snapshot.rows.length || snapshot.complete ? snapshot.rows : undefined; }
export const subscribeOrders = ordersCache.subscribe;
export const getOrdersPageSnapshot = ordersCache.snapshot;
export const loadNextOrdersPage = ordersCache.next;
export function getOrderSnapshot(id: string) { return orderCache.peek(id); }
export function getOrders(force = false): Promise<OrderRecord[]> {
  if (force && !ordersCache.snapshot().loading) ordersCache.invalidate();
  return ordersCache.resume();
}
export function getOrderById(id: string, reconcile = false): Promise<OrderRecord | null> {
  return orderCache.read(id, async () => {
    try { const order = mapOrder((await apiRequest<{ data: BackendOrder }>("orders/" + encodeURIComponent(id) + (reconcile ? "?paymongo_return=1" : ""))).data); return order; }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }, reconcile);
}
const orderSubmission = createOrderSubmission<BackendOrder>(apiRequest, Platform.OS === "web" ? "web" : "native", (proof) => {
  const file = new File(proof.uri);
  if (!file.exists) throw new Error("Payment proof is no longer available. Choose the image again.");
  return file;
});
export async function placeOrder(input: OrderInput): Promise<{ order: OrderRecord; redirectUrl?: string; reconciliationPending: boolean }> {
  const revision = getSessionRevision();
  const result = await orderSubmission.placeOrder(input);
  const order = mapOrder(result.data);
  if (revision === getSessionRevision()) { clearOrders(); orderCache.seed(order.id, order); }
  invalidateCatalog();
  return { order, redirectUrl: result.payment?.redirect_url, reconciliationPending: result.payment?.status === "reconciliation_pending" };
}

export async function requestOrderCancellation(id: string, customerNote?: string): Promise<OrderRecord> {
  const revision = getSessionRevision();
  const updated = mapOrder((await apiRequest<{ data: BackendOrder }>(`orders/${encodeURIComponent(id)}/cancellation-requests`, { method: "POST", body: JSON.stringify({ customer_note: customerNote }) })).data);
  if (revision === getSessionRevision()) { clearOrders(); orderCache.seed(id, updated); }
  return updated;
}
export async function submitReturnRequest(id: string, input: { order_item_id: number; quantity: number; reason_code: string; reason?: string }): Promise<void> {
  await apiRequest(`orders/${encodeURIComponent(id)}/return-requests`, { method: "POST", body: JSON.stringify(input) });
  clearOrders();
}
export async function withdrawReturnRequest(id: string, returnRequestId: number): Promise<void> {
  await apiRequest(`orders/${encodeURIComponent(id)}/return-requests/${returnRequestId}/withdraw`, { method: "POST" });
  clearOrders();
}
export async function retryHostedPayment(id: string): Promise<{ payment?: { redirect_url?: string; status?: string }; data?: BackendOrder }> {
  return apiRequest(`orders/${encodeURIComponent(id)}/paymongo/retry`, { method: "POST" });
}
export async function resubmitPaymentProof(id: string, proof: { uri: string; name: string; type: string }): Promise<OrderRecord> {
  const revision = getSessionRevision();
  const updated = mapOrder(await orderSubmission.resubmitPaymentProof(id, proof));
  if (revision === getSessionRevision()) { clearOrders(); orderCache.seed(id, updated); }
  return updated;
}
export async function cancelPlacedOrder(id: string): Promise<OrderRecord> {
  const revision = getSessionRevision();
  const updated = mapOrder((await apiRequest<{ data: BackendOrder }>(`orders/${encodeURIComponent(id)}/cancel`, { method: "POST" })).data);
  if (revision === getSessionRevision()) { clearOrders(); orderCache.seed(id, updated); }
  return updated;
}
