export type NotificationTarget =
  | { screen: "order_detail"; id: number; type?: string; channel?: string }
  | { screen: "notifications"; id?: undefined; type?: string; channel?: string };

/** Accepts the current Laravel deep_link payload and the flat mobile contract. */
export function parseNotificationTarget(data: Record<string, unknown> | undefined): NotificationTarget {
  const nested = data?.deep_link;
  const payload = nested && typeof nested === "object" ? nested as Record<string, unknown> : data;
  const screen = payload?.screen;
  const rawId = payload && "id" in payload ? payload.id : payload && "order_id" in payload ? payload.order_id : undefined;
  const id = typeof rawId === "number" ? rawId : typeof rawId === "string" && /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  const metadata = {
    ...(typeof data?.type === "string" ? { type: data.type } : {}),
    ...(typeof data?.channel === "string" ? { channel: data.channel } : {}),
  };
  if (screen === "order_detail" && Number.isSafeInteger(id) && id > 0) return { screen, id, ...metadata };
  return { screen: "notifications", ...metadata };
}
