import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@/hooks/useSession";
import { scheduleLocalNotification } from "@/lib/pushNotifications";
import { getPushDeviceStatus, type PushDeviceStatus } from "@/lib/pushDevice";
import { useToast } from "@/hooks/useToast";
import { useTheme } from "@/theme/ThemeProvider";

const statusLabels = {
  checking: "Checking notification access",
  unsupported: "Push unavailable on this platform",
  "not-enabled": "Notifications are off",
  denied: "Notifications are blocked",
  muted: "Order banners are off",
  allowed: "Notification access is allowed",
  enabled: "Order updates are enabled",
  error: "Could not register this device",
} as const;

type DeviceChecks = {
  permission: string;
  channel: string;
  registration: PushDeviceStatus | null;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View className="flex-row gap-3 border-b border-border py-2.5 last:border-b-0">
    <Text className="w-28 text-xs text-muted-foreground">{label}</Text>
    <Text selectable className="flex-1 text-xs text-foreground">{value}</Text>
  </View>;
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { session } = useSession();
  const { pushStatus, pushMessage, refreshPushStatus } = useNotifications();
  const { showToast } = useToast();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [checks, setChecks] = useState<DeviceChecks | null>(null);
  const [checkError, setCheckError] = useState("");
  const busy = pushStatus === "checking";
  const signedIn = session.mode === "customer";
  const statusColor = pushStatus === "enabled" || pushStatus === "allowed" ? "#22c55e" : pushStatus === "error" || pushStatus === "denied" || pushStatus === "muted" ? "#ef4444" : isDark ? "#9ca3af" : "#68717e";
  const statusLabel = statusLabels[pushStatus];

  const inspectDevice = useCallback(async () => {
    setIsInspecting(true);
    setCheckError("");
    try {
      await refreshPushStatus();
      const permission = await Notifications.getPermissionsAsync();
      const channel = Platform.OS === "android" ? await Notifications.getNotificationChannelAsync("order-updates-v2") : null;
      const registration = signedIn ? await getPushDeviceStatus() : null;
      setChecks({
        permission: permission.granted ? "Allowed" : permission.canAskAgain ? "Not allowed yet" : "Blocked in device settings",
        channel: Platform.OS === "android" ? !channel ? "Missing" : channel.importance >= Notifications.AndroidImportance.HIGH ? "High importance" : `Low importance (${channel.importance})` : "Managed by iOS",
        registration,
      });
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : "Could not check this device.");
    } finally {
      setIsInspecting(false);
    }
  }, [refreshPushStatus, signedIn]);

  useActiveFocusEffect(useCallback(() => {
    void inspectDevice();
  }, [inspectDevice]));

  async function checkForAppUpdate() {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      if (!Updates.isEnabled) {
        showToast("App updates are unavailable in this build.", "error");
        return;
      }
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        showToast("This app is running the latest compatible update.");
        return;
      }
      await Updates.fetchUpdateAsync();
      showToast("Update downloaded. Restarting Battlefront.");
      await Updates.reloadAsync();
    } catch {
      showToast("Could not check for an app update. Try again when online.", "error");
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  async function sendTestNotification(locked: boolean) {
    if (isSendingTest) return;
    setIsSendingTest(true);
    try {
      await scheduleLocalNotification("Battlefront test notification", "Notifications are set up on this device.", { screen: "notifications", type: "test" }, locked ? 10 : 5);
      showToast(locked ? "Lock the phone now. Test alert in 10 seconds." : "Keep the app open. Test banner in 5 seconds.");
    } catch {
      showToast("Could not send a test notification", "error");
    } finally {
      setIsSendingTest(false);
    }
  }

  const lastDelivery = checks?.registration?.last_delivery;
  const providerResult = !lastDelivery ? "No remote delivery recorded" : lastDelivery.error_code
    ? `${lastDelivery.error_code}${lastDelivery.current_registration ? "" : " (previous registration)"}`
    : `${lastDelivery.status}${lastDelivery.current_registration ? "" : " (previous registration)"}`;

  return <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
    <ScreenHeader title="Order notifications" subtitle="Manage alerts on this device" onBack={() => router.back()} />
    <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
      <View className="rounded-lg border border-border bg-card p-5">
        <View className="h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Ionicons name="notifications-outline" size={24} color="#ef1b1b" />
        </View>
        <Text className="mt-4 text-foreground text-lg font-bold">Stay up to date on your orders</Text>
        <Text className="mt-2 text-muted-foreground text-sm leading-6">Order updates appear in your inbox. Allow device alerts to see them while Battlefront is in the background.</Text>

        <View className="mt-5 flex-row items-center gap-3 rounded-lg border border-border bg-secondary p-3">
          {busy ? <ActivityIndicator color={statusColor} /> : <Ionicons name={pushStatus === "enabled" || pushStatus === "allowed" ? "checkmark-circle" : pushStatus === "error" || pushStatus === "denied" || pushStatus === "muted" ? "alert-circle" : "notifications-off-outline"} size={20} color={statusColor} />}
          <View className="flex-1">
            <Text className="text-foreground text-sm font-semibold">{statusLabel}</Text>
            {pushMessage ? <Text accessibilityRole={pushStatus === "error" ? "alert" : undefined} className="mt-1 text-muted-foreground text-xs leading-5">{pushMessage}</Text> : null}
          </View>
        </View>

        {pushStatus === "denied" || pushStatus === "muted" ? <Pressable onPress={() => void Linking.openSettings()} className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4">
          <Text className="text-primary-foreground text-sm font-bold">Open device settings</Text>
          <Ionicons name="open-outline" size={16} color="#ffffff" />
        </Pressable> : null}

        {pushStatus !== "denied" && pushStatus !== "muted" && pushStatus !== "unsupported" && Platform.OS !== "web" ? <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} className="mt-2 min-h-11 items-center justify-center rounded-lg border border-border px-4">
          <Text className="text-foreground text-sm font-semibold">Manage in device settings</Text>
        </Pressable> : null}

        {checks?.permission === "Allowed" && Platform.OS !== "web" ? <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSendingTest }}
          disabled={isSendingTest}
          onPress={() => void sendTestNotification(false)}
          className="mt-2 min-h-11 flex-row items-center justify-center gap-2 rounded-lg border border-border px-4"
          style={({ pressed }) => ({ opacity: isSendingTest ? 0.6 : pressed ? 0.75 : 1 })}
        >
          {isSendingTest ? <ActivityIndicator size="small" color={statusColor} /> : <Ionicons name="paper-plane-outline" size={16} color={statusColor} />}
          <Text className="text-foreground text-sm font-semibold">{isSendingTest ? "Scheduling test..." : "Test banner with app open"}</Text>
        </Pressable> : null}

        {checks?.permission === "Allowed" && Platform.OS !== "web" ? <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSendingTest }}
          disabled={isSendingTest}
          onPress={() => void sendTestNotification(true)}
          className="mt-2 min-h-11 items-center justify-center rounded-lg border border-border px-4"
        >
          <Text className="text-foreground text-sm font-semibold">Test while phone is locked</Text>
        </Pressable> : null}

        {pushStatus === "unsupported" && Platform.OS === "web" ? <Text className="mt-3 text-muted-foreground text-xs leading-5">Install the Battlefront iOS or Android app to receive push alerts.</Text> : null}
      </View>
      <View className="mt-4 rounded-lg border border-border bg-card p-5">
        <Text className="text-foreground text-base font-bold">Device checks</Text>
        <Text className="mt-1 text-muted-foreground text-xs leading-5">These checks show which part of notification delivery needs attention.</Text>
        <View className="mt-3">
          <DetailRow label="App update" value={Updates.updateId ?? (Updates.isEmbeddedLaunch ? "Built into APK" : "Unavailable")} />
          <DetailRow label="Update channel" value={Updates.channel ?? "Unavailable"} />
          <DetailRow label="Runtime" value={Updates.runtimeVersion ?? "Unavailable"} />
          <DetailRow label="Permission" value={checks?.permission ?? "Checking"} />
          <DetailRow label="Order channel" value={checks?.channel ?? "Checking"} />
          <DetailRow label="Server registration" value={!signedIn ? "Sign in to register" : !checks ? "Checking" : !checks.registration ? "Not registered" : checks.registration.is_active ? `Active (#${checks.registration.id})` : "Inactive"} />
          <DetailRow label="Server channel" value={checks?.registration?.notification_channel ?? "Not registered"} />
          <DetailRow label="Latest remote push" value={providerResult} />
        </View>
        {checkError ? <Text accessibilityRole="alert" className="mt-2 text-sm text-primary-text">{checkError}</Text> : null}
        <Pressable accessibilityRole="button" disabled={isInspecting} onPress={() => void inspectDevice()} className="mt-3 min-h-11 items-center justify-center rounded-lg bg-primary px-4">
          <Text className="text-primary-foreground text-sm font-bold">{isInspecting ? "Checking..." : "Re-register and check device"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isCheckingUpdate} onPress={() => void checkForAppUpdate()} className="mt-2 min-h-11 items-center justify-center rounded-lg border border-border px-4">
          <Text className="text-foreground text-sm font-semibold">{isCheckingUpdate ? "Checking for update..." : "Check for app update"}</Text>
        </Pressable>
      </View>
      <Text className="mt-4 px-1 text-muted-foreground text-xs leading-5">Your notification inbox remains available even when device alerts are off. Alert banners and sounds also depend on your device settings.</Text>
    </ScrollView>
  </SafeAreaView>;
}
