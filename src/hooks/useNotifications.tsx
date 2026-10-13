import Constants from "expo-constants";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getPushDeviceStatus, registerPushDevice } from "@/lib/pushDevice";
import { getSessionRevision } from "@/lib/api";
import { parseNotificationTarget, type NotificationTarget } from "@/lib/notificationPayload";
import { useSession } from "./useSession";

export type PushStatus = "checking" | "unsupported" | "not-enabled" | "denied" | "muted" | "allowed" | "enabled" | "error";
type NotificationContextValue = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
  pushStatus: PushStatus;
  pushMessage: string;
  refreshPushStatus: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
const supportsRemotePush = Platform.OS === "ios" || Platform.OS === "android";
const PUSH_PROMPTED_KEY = "battlefront-push-permission-prompted";
const ORDER_CHANNEL = "order-updates-v2";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session, isHydrated } = useSession();
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const owner = session.mode === "customer" ? session.user.id : null;
  const sessionRevision = getSessionRevision();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingTarget, setPendingTarget] = useState<NotificationTarget | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>(supportsRemotePush ? "checking" : "unsupported");
  const [pushMessage, setPushMessage] = useState("");
  const countRequest = useRef(0);
  const pushRequest = useRef(0);
  const invalidTokenReset = useRef<string | null>(null);
  const resetInFlight = useRef<Promise<Notifications.DevicePushToken> | null>(null);
  const recoveredToken = useRef<{ key: string; token: Notifications.DevicePushToken } | null>(null);
  const lastHandledResponse = useRef<string | null>(null);
  const startupPermissionRequest = useRef(false);
  const [startupPermissionReady, setStartupPermissionReady] = useState(!supportsRemotePush);
  const updateUnreadCount = useCallback((count: number) => {
    countRequest.current++;
    setUnreadCount(count);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (owner === null) return;
    const request = ++countRequest.current;
    const revision = getSessionRevision();
    try {
      const count = await getUnreadNotificationCount();
      if (request === countRequest.current && revision === getSessionRevision()) setUnreadCount(count);
    } catch { /* Retry on the next active refresh. */ }
  }, [owner]);

  const syncPushRegistration = useCallback(async (allowStartupPrompt: boolean, devicePushToken?: Notifications.DevicePushToken) => {
    const request = ++pushRequest.current;
    const revision = getSessionRevision();
    if (!supportsRemotePush) {
      setPushStatus("unsupported");
      setPushMessage("Push notifications are available in the iOS and Android app.");
      return;
    }
    setPushStatus("checking");
    setPushMessage("");
    try {
      if (Platform.OS === "android") {
        const channel = await Notifications.setNotificationChannelAsync(ORDER_CHANNEL, {
          name: "Order updates",
          importance: Notifications.AndroidImportance.HIGH,
          sound: "default",
        });
        if (channel === null) throw new Error("Could not create the Order updates notification channel.");
      }
      let permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted && allowStartupPrompt && permissions.canAskAgain) {
        const alreadyPrompted = await SecureStore.getItemAsync(PUSH_PROMPTED_KEY);
        if (!alreadyPrompted) {
          await SecureStore.setItemAsync(PUSH_PROMPTED_KEY, "1");
          permissions = await Notifications.requestPermissionsAsync();
        }
      }
      if (request !== pushRequest.current || revision !== getSessionRevision()) return;
      if (!permissions.granted) {
        const denied = !permissions.canAskAgain;
        setPushStatus(denied ? "denied" : "not-enabled");
        setPushMessage(denied
          ? "Notifications are blocked for Battlefront. Allow them in your device settings to receive order updates."
          : "Notifications are off. You can change access in your device settings.");
        return;
      }
      if (owner === null) {
        setPushStatus("allowed");
        setPushMessage("Notifications are allowed. Sign in to register this device for order updates.");
        return;
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error("Push setup is missing its EAS project ID.");
      let tokenForExpo = devicePushToken;
      if (Platform.OS === "android") {
        const previous = await getPushDeviceStatus();
        const lastDelivery = previous?.last_delivery;
        if (previous && !previous.is_active && lastDelivery?.error_code === "DeviceNotRegistered" && lastDelivery.current_registration) {
          const resetKey = `${previous.id}:${lastDelivery.updated_at}`;
          if (invalidTokenReset.current !== resetKey) {
            invalidTokenReset.current = resetKey;
            const reset = Notifications.unregisterForNotificationsAsync().then(() => Notifications.getDevicePushTokenAsync());
            resetInFlight.current = reset;
            try {
              tokenForExpo = await reset;
              recoveredToken.current = { key: resetKey, token: tokenForExpo };
            } catch (error) {
              invalidTokenReset.current = null;
              recoveredToken.current = null;
              throw error;
            } finally {
              if (resetInFlight.current === reset) resetInFlight.current = null;
            }
          } else if (resetInFlight.current) {
            tokenForExpo = await resetInFlight.current;
          } else if (recoveredToken.current?.key === resetKey) {
            tokenForExpo = recoveredToken.current.token;
          }
        }
      }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken: tokenForExpo })).data;
      if (request !== pushRequest.current || revision !== getSessionRevision()) return;
      const registration = await registerPushDevice(token);
      if (request === pushRequest.current && revision === getSessionRevision()) {
        const channel = Platform.OS === "android" ? await Notifications.getNotificationChannelAsync(ORDER_CHANNEL) : null;
        if (request !== pushRequest.current || revision !== getSessionRevision()) return;
        const muted = channel !== null && channel !== undefined && channel.importance < Notifications.AndroidImportance.HIGH;
        setPushStatus(muted ? "muted" : "enabled");
        setPushMessage(muted ? "Order update banners are off in device settings. Set the Order updates channel to high importance to see pop-up alerts." : registration ? "This device is registered. Check the latest provider result below to confirm remote delivery." : "Device registration is pending.");
      }
    } catch (failure) {
      if (request === pushRequest.current && revision === getSessionRevision()) {
        setPushStatus("error");
        setPushMessage(failure instanceof Error ? failure.message : "Could not register this device for order updates.");
      }
    }
  }, [owner]);

  const refreshPushStatus = useCallback(() => syncPushRegistration(false), [syncPushRegistration]);

  useEffect(() => {
    if (!supportsRemotePush || startupPermissionRequest.current) return;
    startupPermissionRequest.current = true;
    void syncPushRegistration(true).finally(() => setStartupPermissionReady(true));
  }, [syncPushRegistration]);

  useEffect(() => {
    const ready = () => setNavigationReady(navigation.isReady());
    ready();
    const readySubscription = navigation.addListener("ready", ready);
    const stateSubscription = navigation.addListener("state", ready);
    return () => { readySubscription(); stateSubscription(); };
  }, [navigation]);

  useEffect(() => {
    countRequest.current++;
    setUnreadCount(0);
    if (owner !== null) void refreshUnreadCount();
  }, [owner, refreshUnreadCount]);

  useEffect(() => {
    if (owner === null || !isHydrated || !startupPermissionReady || !supportsRemotePush) return;
    void syncPushRegistration(false);
  }, [owner, isHydrated, startupPermissionReady, sessionRevision, syncPushRegistration]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void refreshUnreadCount();
      if (owner !== null) void refreshPushStatus();
    });
    return () => subscription.remove();
  }, [owner, refreshUnreadCount, refreshPushStatus]);

  useEffect(() => {
    if (owner === null) return;
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void refreshUnreadCount();
    }, 10_000);
    return () => clearInterval(interval);
  }, [owner, refreshUnreadCount]);

  useEffect(() => {
    if (!supportsRemotePush) return;
    let active = true;
    let received: { remove: () => void } | undefined;
    let responses: { remove: () => void } | undefined;
    let tokenSubscription: { remove: () => void } | undefined;
    async function listen() {
      const handleResponse = (response: { notification: { request: { identifier: string; content: { data?: Record<string, unknown> } } } }) => {
        const identifier = response.notification.request.identifier;
        if (identifier === lastHandledResponse.current) return;
        lastHandledResponse.current = identifier;
        setPendingTarget(parseNotificationTarget(response.notification.request.content.data));
        void refreshUnreadCount();
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      };
      received = Notifications.addNotificationReceivedListener((notification) => {
        if (owner === null) return;
        const data = notification.request.content.data;
        if (data?.type !== "test") {
          countRequest.current++;
          setUnreadCount((count) => count + 1);
          setTimeout(() => void refreshUnreadCount(), 300);
        }
      });
      responses = Notifications.addNotificationResponseReceivedListener(handleResponse);
      tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
        if (active && owner !== null) void syncPushRegistration(false, devicePushToken);
      });
      const last = await Notifications.getLastNotificationResponseAsync();
      if (active && last) handleResponse(last);
    }
    void listen().catch(() => undefined);
    return () => { active = false; received?.remove(); responses?.remove(); tokenSubscription?.remove(); };
  }, [owner, refreshUnreadCount, syncPushRegistration]);

  useEffect(() => {
    if (pendingTarget === null || !navigationReady) return;
    if (pendingTarget.screen === "order_detail") {
      // Keep the target queued while signed out; completing sign-in runs this effect again.
      if (owner === null) return;
      router.push(`/orders/${pendingTarget.id}`);
    } else {
      router.push("/notifications");
    }
    setPendingTarget(null);
  }, [owner, pendingTarget, navigationReady, router]);

  const value = useMemo(() => ({ unreadCount, setUnreadCount: updateUnreadCount, refreshUnreadCount, pushStatus, pushMessage, refreshPushStatus }), [unreadCount, updateUnreadCount, refreshUnreadCount, pushStatus, pushMessage, refreshPushStatus]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
