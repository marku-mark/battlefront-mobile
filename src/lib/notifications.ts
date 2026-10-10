import { apiRequest, getSessionRevision } from "./api";
import { createNotificationApi } from "./notificationApi";

export type { OrderNotification, NotificationPage } from "./notificationApi";

export const {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} = createNotificationApi(apiRequest, getSessionRevision);
