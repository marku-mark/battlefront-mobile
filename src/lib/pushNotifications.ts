import * as Notifications from "expo-notifications";

export function scheduleLocalNotification(title: string, body: string, data: Record<string, unknown>, delaySeconds = 5) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: "default" },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds, channelId: "order-updates-v2" },
  });
}
