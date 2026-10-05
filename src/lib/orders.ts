import { apiRequest, ApiError, invalidateCatalog } from "./api";
import { collectPages } from "./apiClient";
import { Platform } from "react-native";
import { File } from "expo-file-system";
import { createOrderSubmission, type OrderInput } from "./orderSubmission";
export type { OrderInput } from "./orderSubmission";
export type OrderProductLine = { productId: string; quantity: number; variant: string | null };
export type OrderRecord = { id: string; reference: string; date: string; status: string; statusValue: string; items: string; total: string; address?: string; phone?: string; deliveryMethod?: string; paymentMethod?: string; productLines?: OrderProductLine[]; canReturn: boolean; canCancel: boolean; canResubmitProof: boolean; paymentNotice?: string };
type BackendOrder = { id: number; reference: string; created_at: string; status: { value: string; label: string }; fulfillment: { label: string; delivery_address?: string | null }; payment: { method: { label: string }; notice?: string; can_resubmit_proof?: boolean }; recipient?: { contact_number: string }; total: string; total_quantity: number; items?: { product: { id: number; name: string }; quantity: number }[] };
function mapOrder(row: BackendOrder): OrderRecord {
  return { id: String(row.id), reference: row.reference, date: new Date(row.created_at).toLocaleDateString("en-PH"), status: row.status.label, statusValue: row.status.value,
    items: row.items?.map((item) => `${item.quantity} × ${item.product.name}`).join(", ") ?? `${row.total_quantity} item(s)`,
    total: `₱${Number(row.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, address: row.fulfillment.delivery_address ?? undefined, phone: row.recipient?.contact_number,
    deliveryMethod: row.fulfillment.label, paymentMethod: row.payment.method.label,
    productLines: row.items?.map((item) => ({ productId: String(item.product.id), quantity: item.quantity, variant: null })),
    canCancel: false, canReturn: false, canResubmitProof: row.payment.can_resubmit_proof ?? false, paymentNotice: row.payment.notice };
}
export async function getOrders(): Promise<OrderRecord[]> { return (await collectPages<BackendOrder>(apiRequest, "orders")).map(mapOrder); }
export async function getOrderById(id: string): Promise<OrderRecord | null> {
  try { return mapOrder((await apiRequest<{ data: BackendOrder }>(`orders/${encodeURIComponent(id)}`)).data); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}
const orderSubmission = createOrderSubmission<BackendOrder>(apiRequest, Platform.OS === "web" ? "web" : "native", (proof) => {
  const file = new File(proof.uri);
  if (!file.exists) throw new Error("Payment proof is no longer available. Choose the image again.");
  return file;
});
export async function placeOrder(input: OrderInput): Promise<OrderRecord> {
  const row = await orderSubmission.placeOrder(input);
  invalidateCatalog();
  return mapOrder(row);
}
export async function resubmitPaymentProof(id: string, proof: { uri: string; name: string; type: string }): Promise<OrderRecord> {
  return mapOrder(await orderSubmission.resubmitPaymentProof(id, proof));
}
export async function cancelPlacedOrder(_id: string): Promise<OrderRecord | null> { throw new Error("Customer cancellation is not supported. Contact Battlefront staff."); }
