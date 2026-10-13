import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@/hooks/useSession";
import { scheduleLocalNotification } from "@/lib/pushNotifications";
import { useToast } from "@/hooks/useToast";
import { useTheme } from "@/theme/ThemeProvider";

const statusLabels = {
  checking: "Checking notification access",
  unsupported: "Push unavailable on this platform",
  "not-enabled": "Notifications are off",
  denied: "Notifications are blocked",
  enabled: "Order updates are enabled",
  error: "Could not register this device",
} as const;

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { session } = useSession();
  const { pushStatus, pushMessage, refreshPushStatus } = useNotifications();
  const { showToast } = useToast();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const busy = pushStatus === "checking";
  const signedIn = session.mode === "customer";
  const statusColor = pushStatus === "enabled" ? "#22c55e" : pushStatus === "error" || pushStatus === "denied" ? "#ef4444" : isDark ? "#9ca3af" : "#68717e";
  const statusLabel = pushStatus === "enabled" && !signedIn ? "Notification access is allowed" : statusLabels[pushStatus];

  useActiveFocusEffect(useCallback(() => {
    void refreshPushStatus();
  }, [refreshPushStatus]));

  async function sendTestNotification() {
    if (isSendingTest) return;
    setIsSendingTest(true);
    try {
      await scheduleLocalNotification("Battlefront test notification", "Notifications are set up on this device.", { screen: "notifications", type: "test", channel: "default" });
      showToast("Test notification scheduled");
    } catch {
      showToast("Could not send a test notification", "error");
    } finally {
      setIsSendingTest(false);
    }
  }

  return <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
    <ScreenHeader title="Order notifications" subtitle="Manage alerts on this device" onBack={() => router.back()} />
    <View className="p-4">
      <View className="rounded-2xl border border-border bg-card p-5">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Ionicons name="notifications-outline" size={24} color="#ef1b1b" />
        </View>
        <Text className="mt-4 text-foreground text-lg font-bold">Stay up to date on your orders</Text>
        <Text className="mt-2 text-muted-foreground text-sm leading-6">Battlefront asks for notification access when the app first opens. When allowed, order updates appear here and as push alerts while the app is in the background.</Text>

        <View className="mt-5 flex-row items-center gap-3 rounded-xl border border-border bg-secondary p-3">
          {busy ? <ActivityIndicator color={statusColor} /> : <Ionicons name={pushStatus === "enabled" ? "checkmark-circle" : pushStatus === "error" || pushStatus === "denied" ? "alert-circle" : "notifications-off-outline"} size={20} color={statusColor} />}
          <View className="flex-1">
            <Text className="text-foreground text-sm font-semibold">{statusLabel}</Text>
            {pushMessage ? <Text accessibilityRole={pushStatus === "error" ? "alert" : undefined} className="mt-1 text-muted-foreground text-xs leading-5">{pushMessage}</Text> : null}
          </View>
        </View>

        {pushStatus === "denied" ? <Pressable onPress={() => void Linking.openSettings()} className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4">
          <Text className="text-primary-foreground text-sm font-bold">Open device settings</Text>
          <Ionicons name="open-outline" size={16} color="#ffffff" />
        </Pressable> : null}

        {pushStatus !== "denied" && pushStatus !== "unsupported" && Platform.OS !== "web" ? <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} className="mt-2 min-h-11 items-center justify-center rounded-xl border border-border px-4">
          <Text className="text-foreground text-sm font-semibold">Manage in device settings</Text>
        </Pressable> : null}

        {signedIn && pushStatus === "enabled" ? <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSendingTest }}
          disabled={isSendingTest}
          onPress={() => void sendTestNotification()}
          className="mt-2 min-h-11 flex-row items-center justify-center gap-2 rounded-xl border border-border px-4"
          style={({ pressed }) => ({ opacity: isSendingTest ? 0.6 : pressed ? 0.75 : 1 })}
        >
          {isSendingTest ? <ActivityIndicator size="small" color={statusColor} /> : <Ionicons name="paper-plane-outline" size={16} color={statusColor} />}
          <Text className="text-foreground text-sm font-semibold">{isSendingTest ? "Sending test..." : "Send test notification"}</Text>
        </Pressable> : null}

        {pushStatus === "unsupported" && Platform.OS === "web" ? <Text className="mt-3 text-muted-foreground text-xs leading-5">Install the Battlefront iOS or Android app to receive push alerts.</Text> : null}
      </View>
    </View>
  </SafeAreaView>;
}
