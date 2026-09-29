import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEMO_ORDERS } from "@/lib/mockAccount";

export type OrderRecord = {
  id: string;
  date: string;
  status: string;
  items: string;
  total: string;
  address?: string;
  phone?: string;
  deliveryMethod?: string;
  paymentMethod?: string;
  productLines?: OrderProductLine[];
};

export type OrderProductLine = {
  productId: string;
  quantity: number;
  variant: string | null;
};

const PLACED_ORDERS_STORAGE_KEY = "battlefront-placed-orders";

export async function getOrders(): Promise<OrderRecord[]> {
  const storedOrders = await getStoredOrders();
  const storedIds = new Set(storedOrders.map((order) => order.id));
  const demoOrders = DEMO_ORDERS.filter((order) => !storedIds.has(order.id));
  return [...storedOrders, ...demoOrders];
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  const orders = await getOrders();
  return orders.find((order) => order.id === orderId) ?? null;
}

export async function savePlacedOrder(order: OrderRecord): Promise<void> {
  const storedOrders = await getStoredOrders();
  await AsyncStorage.setItem(
    PLACED_ORDERS_STORAGE_KEY,
    JSON.stringify([order, ...storedOrders.filter((existing) => existing.id !== order.id)]),
  );
}

export async function cancelPlacedOrder(orderId: string): Promise<OrderRecord | null> {
  const storedOrders = await getStoredOrders();
  const existingOrder = storedOrders.find((order) => order.id === orderId);
  if (!existingOrder || existingOrder.status !== "Ordered") return null;

  const cancelledOrder = { ...existingOrder, status: "Cancelled" };
  await AsyncStorage.setItem(
    PLACED_ORDERS_STORAGE_KEY,
    JSON.stringify([cancelledOrder, ...storedOrders.filter((order) => order.id !== orderId)]),
  );
  return cancelledOrder;
}

async function getStoredOrders(): Promise<OrderRecord[]> {
  try {
    const rawOrders = await AsyncStorage.getItem(PLACED_ORDERS_STORAGE_KEY);
    if (!rawOrders) return [];
    const parsed: unknown = JSON.parse(rawOrders);
    return Array.isArray(parsed) ? parsed.filter(isOrderRecord) : [];
  } catch {
    return [];
  }
}

function isOrderRecord(value: unknown): value is OrderRecord {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<OrderRecord>;
  return typeof order.id === "string"
    && typeof order.date === "string"
    && typeof order.status === "string"
    && typeof order.items === "string"
    && typeof order.total === "string"
    && (order.address === undefined || typeof order.address === "string")
    && (order.phone === undefined || typeof order.phone === "string")
    && (order.deliveryMethod === undefined || typeof order.deliveryMethod === "string")
    && (order.paymentMethod === undefined || typeof order.paymentMethod === "string")
    && (order.productLines === undefined || (
      Array.isArray(order.productLines)
      && order.productLines.every((line) => Boolean(line)
        && typeof line.productId === "string"
        && typeof line.quantity === "number"
        && line.quantity > 0
        && (typeof line.variant === "string" || line.variant === null))
    ));
}