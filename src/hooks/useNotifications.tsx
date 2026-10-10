import Constants from "expo-constants";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { registerPushDevice } from "@/lib/pushDevice";
import { getSessionRevision } from "@/lib/api";
import { useSession } from "./useSession";

type NotificationContextValue = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session, isHydrated } = useSession();
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const owner = session.mode === "customer" ? session.user.id : null;
  const sessionRevision = getSessionRevision();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const countRequest = useRef(0);
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
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshUnreadCount();
    });
    return () => subscription.remove();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (owner === null || !isHydrated || Platform.OS === "web") return;
    let active = true;
    let registrationPending = false;
    const revision = getSessionRevision();
    async function register() {
      if (registrationPending) return;
      registrationPending = true;
      try {
        const Notifications = await import("expo-notifications");
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) return;
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Order updates",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        const existing = await Notifications.getPermissionsAsync();
        const status = existing.granted || !existing.canAskAgain ? existing : await Notifications.requestPermissionsAsync();
        if (!status.granted || !active || revision !== getSessionRevision()) return;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (active && revision === getSessionRevision()) await registerPushDevice(token);
      } finally { registrationPending = false; }
    }
    void register().catch(() => undefined);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && active) void register().catch(() => undefined);
    });
    return () => { active = false; subscription.remove(); };
  }, [owner, isHydrated, sessionRevision]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    let received: { remove: () => void } | undefined;
    let responses: { remove: () => void } | undefined;
    async function listen() {
      const Notifications = await import("expo-notifications");
      if (!active) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });
      const handleResponse = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => {
        const link = response.notification.request.content.data?.deep_link;
        if (link && typeof link === "object" && "screen" in link && "order_id" in link
          && link.screen === "order_detail" && Number.isSafeInteger(link.order_id) && (link.order_id as number) > 0) {
          setPendingOrderId(link.order_id as number);
        }
        void refreshUnreadCount();
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      };
      received = Notifications.addNotificationReceivedListener(() => { void refreshUnreadCount(); });
      responses = Notifications.addNotificationResponseReceivedListener(handleResponse);
      const last = await Notifications.getLastNotificationResponseAsync();
      if (active && last) handleResponse(last);
    }
    void listen().catch(() => undefined);
    return () => { active = false; received?.remove(); responses?.remove(); };
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (owner === null || pendingOrderId === null || !navigationReady) return;
    router.push(`/orders/${pendingOrderId}`);
    setPendingOrderId(null);
  }, [owner, pendingOrderId, navigationReady, router]);

  const value = useMemo(() => ({ unreadCount, setUnreadCount: updateUnreadCount, refreshUnreadCount }), [unreadCount, updateUnreadCount, refreshUnreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
