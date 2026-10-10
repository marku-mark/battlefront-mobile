export type OrderNotification = {
  id: string;
  event: string;
  title: string;
  body: string;
  occurred_at: string;
  created_at: string | null;
  read_at: string | null;
  is_read: boolean;
  order: {
    id: number;
    reference: string;
    deep_link: { screen: string; order_id: number } | null;
  } | null;
};

export type NotificationPage = {
  data: OrderNotification[];
  meta: { current_page: number; last_page: number; unread_count: number };
};

type Request = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createNotificationApi(request: Request, getRevision: () => number) {
  async function current<T>(load: () => Promise<T>): Promise<T> {
    const revision = getRevision();
    const result = await load();
    if (revision !== getRevision()) throw new Error("Your account changed. Reopen notifications.");
    return result;
  }

  return {
    getNotifications(page = 1) {
      return current(() => request<NotificationPage>(`notifications?page=${page}`));
    },
    async getUnreadNotificationCount() {
      const result = await current(() => request<{ data: { unread_count: number } }>("notifications/unread-count"));
      return result.data.unread_count;
    },
    async markNotificationRead(id: string) {
      const result = await current(() => request<{ data: OrderNotification; meta: { unread_count: number } }>(`notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }));
      return { notification: result.data, unreadCount: result.meta.unread_count };
    },
    async markAllNotificationsRead() {
      const result = await current(() => request<{ data: { unread_count: number } }>("notifications/read-all", { method: "PATCH" }));
      return result.data.unread_count;
    },
  };
}
