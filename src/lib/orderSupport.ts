import AsyncStorage from "@react-native-async-storage/async-storage";

export type OrderReturnRequest = {
  orderId: string;
  reason: string;
  note: string;
  requestedAt: string;
};

const ORDER_RETURN_REQUESTS_STORAGE_KEY = "battlefront-order-return-requests";

export async function getOrderReturnRequests(): Promise<OrderReturnRequest[]> {
  try {
    const storedRequests = await AsyncStorage.getItem(ORDER_RETURN_REQUESTS_STORAGE_KEY);
    if (!storedRequests) return [];
    const parsed: unknown = JSON.parse(storedRequests);
    return Array.isArray(parsed) ? parsed.filter(isOrderReturnRequest) : [];
  } catch {
    return [];
  }
}

export async function saveOrderReturnRequest(
  orderId: string,
  reason: string,
  note: string,
): Promise<OrderReturnRequest[]> {
  const requests = await getOrderReturnRequests();
  if (requests.some((request) => request.orderId === orderId)) return requests;

  const nextRequests = [
    { orderId, reason, note: note.trim(), requestedAt: new Date().toISOString() },
    ...requests,
  ];
  await AsyncStorage.setItem(ORDER_RETURN_REQUESTS_STORAGE_KEY, JSON.stringify(nextRequests));
  return nextRequests;
}

function isOrderReturnRequest(value: unknown): value is OrderReturnRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<OrderReturnRequest>;
  return typeof request.orderId === "string"
    && typeof request.reason === "string"
    && typeof request.note === "string"
    && typeof request.requestedAt === "string";
}