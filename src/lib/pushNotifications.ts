import * as Notifications from "expo-notifications";

export function scheduleLocalNotification(title: string, body: string, data: Record<string, unknown>) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: false },
    trigger: null,
  });
}
