import Constants from "expo-constants";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { registerPushDevice } from "@/lib/pushDevice";
import { getSessionRevision } from "@/lib/api";
import { parseNotificationTarget, type NotificationTarget } from "@/lib/notificationPayload";
import { useToast } from "@/hooks/useToast";
import { useSession } from "./useSession";

export type PushStatus = "checking" | "unsupported" | "not-enabled" | "denied" | "enabled" | "error";
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session, isHydrated } = useSession();
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const owner = session.mode === "customer" ? session.user.id : null;
  const { showToast } = useToast();
  const sessionRevision = getSessionRevision();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingTarget, setPendingTarget] = useState<NotificationTarget | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>(supportsRemotePush ? "checking" : "unsupported");
  const [pushMessage, setPushMessage] = useState("");
  const countRequest = useRef(0);
  const pushRequest = useRef(0);
  const startupPermissionRequest = useRef(false);
  const [startupPermissionReady, setStartupPermissionReady] = useState(!supportsRemotePush);
  const updateUnreadCount = useCallback((count: number) => {
    countRequest.current++;
    setUnreadCount(count);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (owner === null) return;
    const request = ++countRequest.current;
    try {
      const count = await getUnreadNotificationCount();
      if (request === countRequest.current) setUnreadCount(count);
    } catch { /* History stays usable when a count refresh fails. */ }
  }, [owner]);

  const syncPushRegistration = useCallback(async (allowStartupPrompt: boolean) => {
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
        await Notifications.setNotificationChannelAsync("default", {
          name: "Order updates",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
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
        setPushStatus("enabled");
        setPushMessage("Notifications are allowed. Sign in to register this device for order updates.");
        return;
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error("Push setup is missing its EAS project ID.");
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (request !== pushRequest.current || revision !== getSessionRevision()) return;
      await registerPushDevice(token);
      if (request === pushRequest.current && revision === getSessionRevision()) {
        setPushStatus("enabled");
        setPushMessage("Order updates are enabled on this device.");
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
    if (!supportsRemotePush) return;
    let active = true;
    let received: { remove: () => void } | undefined;
    let responses: { remove: () => void } | undefined;
    let tokenSubscription: { remove: () => void } | undefined;
    async function listen() {
      const handleResponse = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => {
        setPendingTarget(parseNotificationTarget(response.notification.request.content.data));
        void refreshUnreadCount();
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      };
      received = Notifications.addNotificationReceivedListener((notification) => {
        setUnreadCount((count) => count + 1);
        void refreshUnreadCount();
        const { title, body } = notification.request.content;
        showToast([title, body].filter(Boolean).join(": ") || "You have a new notification.", "info");
      });
      responses = Notifications.addNotificationResponseReceivedListener(handleResponse);
      tokenSubscription = Notifications.addPushTokenListener(() => {
        if (active && owner !== null) void syncPushRegistration(false);
      });
      const last = await Notifications.getLastNotificationResponseAsync();
      if (active && last) handleResponse(last);
    }
    void listen().catch(() => undefined);
    return () => { active = false; received?.remove(); responses?.remove(); tokenSubscription?.remove(); };
  }, [owner, refreshUnreadCount, showToast, syncPushRegistration]);

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
