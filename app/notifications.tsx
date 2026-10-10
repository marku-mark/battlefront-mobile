import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@/hooks/useSession";
import { getSessionRevision } from "@/lib/api";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type OrderNotification } from "@/lib/notifications";
import { getResponsiveLayout } from "@/lib/responsive";
import { useTheme } from "@/theme/ThemeProvider";

export default function NotificationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const { isDark } = useTheme();
  const { session } = useSession();
  const owner = session.mode === "customer" ? session.user.id : null;
  const { unreadCount, setUnreadCount } = useNotifications();
  const [loadedOwner, setLoadedOwner] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const loadingMore = useRef(false);

  const loadFirst = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    const revision = getSessionRevision();
    loadingMore.current = false;
    setLoadedOwner(owner);
    setError(null);
    if (owner === null) { setNotifications([]); setPage(0); setIsLoading(false); setIsRefreshing(false); return; }
    if (refresh) setIsRefreshing(true); else setIsLoading(true);
    try {
      const result = await getNotifications();
      if (id !== requestId.current || revision !== getSessionRevision()) return;
      setNotifications(result.data);
      setPage(result.meta.current_page);
      setLastPage(result.meta.last_page);
      setUnreadCount(result.meta.unread_count);
    } catch (failure) {
      if (id === requestId.current && revision === getSessionRevision()) setError(failure instanceof Error ? failure.message : "Notifications are unavailable.");
    } finally {
      if (id === requestId.current) { setIsLoading(false); setIsRefreshing(false); }
    }
  }, [owner, setUnreadCount]);

  useActiveFocusEffect(useCallback(() => {
    void loadFirst();
    return () => { requestId.current++; };
  }, [loadFirst]));

  async function loadMore() {
    if (owner === null || loadedOwner !== owner || page >= lastPage || loadingMore.current || isLoading || isRefreshing) return;
    loadingMore.current = true;
    setIsLoadingMore(true);
    const id = requestId.current;
    const revision = getSessionRevision();
    try {
      const result = await getNotifications(page + 1);
      if (id !== requestId.current || revision !== getSessionRevision()) return;
      setNotifications((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.data.filter((item) => !known.has(item.id))];
      });
      setPage(result.meta.current_page);
      setLastPage(result.meta.last_page);
      setUnreadCount(result.meta.unread_count);
    } catch (failure) {
      if (id === requestId.current) setError(failure instanceof Error ? failure.message : "Could not load more notifications.");
    } finally { loadingMore.current = false; setIsLoadingMore(false); }
  }

  async function openNotification(notification: OrderNotification) {
    const revision = getSessionRevision();
    if (!notification.is_read) {
      try {
        const result = await markNotificationRead(notification.id);
        if (revision === getSessionRevision()) {
          requestId.current++;
          setIsLoading(false);
          setIsRefreshing(false);
          setNotifications((current) => current.map((item) => item.id === notification.id ? result.notification : item));
          setUnreadCount(result.unreadCount);
        }
      } catch (failure) {
        if (revision === getSessionRevision()) setError(failure instanceof Error ? failure.message : "Could not mark notification as read.");
      }
    }
    const link = notification.order?.deep_link;
    if (link?.screen === "order_detail" && Number.isSafeInteger(link.order_id) && link.order_id > 0 && owner !== null && revision === getSessionRevision()) router.push(`/orders/${link.order_id}`);
  }

  async function markAll() {
    const revision = getSessionRevision();
    try {
      const count = await markAllNotificationsRead();
      if (revision !== getSessionRevision()) return;
      requestId.current++;
      setIsLoading(false);
      setIsRefreshing(false);
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(count);
      setError(null);
    } catch (failure) {
      if (revision === getSessionRevision()) setError(failure instanceof Error ? failure.message : "Could not mark notifications as read.");
    }
  }

  const rows = owner !== null && loadedOwner === owner ? notifications : [];
  return <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
    <ScreenHeader title="Notifications" subtitle={owner === null ? "Sign in to see order updates" : unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"} onBack={() => router.back()} right={owner !== null && loadedOwner === owner && !isLoading && unreadCount > 0 ? <Pressable accessibilityLabel="Mark all notifications as read" accessibilityRole="button" onPress={() => void markAll()} hitSlop={8}><Text className="text-primary text-xs font-semibold">Mark all</Text></Pressable> : undefined} />
    {error && <Pressable onPress={() => void loadFirst(true)} className="mx-4 mt-3 rounded-xl border border-primary/40 bg-primary/10 p-3"><Text className="text-foreground text-xs">{error} Tap to retry.</Text></Pressable>}
    {isLoading && rows.length === 0 ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#ef1b1b" /><Text className="text-muted-foreground text-xs mt-3">Loading updates...</Text></View> : <FlatList
      data={rows} keyExtractor={(item) => item.id} refreshing={isRefreshing} onRefresh={() => void loadFirst(true)} onEndReached={() => void loadMore()} onEndReachedThreshold={0.4}
      contentContainerStyle={{ padding: layout.horizontalPadding, paddingBottom: 28, width: "100%", maxWidth: 760, alignSelf: "center", flexGrow: 1 }}
      ListEmptyComponent={<View className="flex-1 items-center justify-center px-6"><View className="w-20 h-20 rounded-full bg-secondary border border-border items-center justify-center"><Ionicons name={error ? "cloud-offline-outline" : "notifications-off-outline"} size={34} color={isDark ? "#9ca3af" : "#68717e"} /></View><Text className="text-foreground text-lg font-semibold mt-5">{owner === null ? "Sign in for updates" : error ? "Notifications unavailable" : "No notifications yet"}</Text></View>}
      ListFooterComponent={isLoadingMore ? <ActivityIndicator color="#ef1b1b" /> : null}
      renderItem={({ item }) => <Pressable accessibilityLabel={`${item.is_read ? "Read" : "Unread"} notification: ${item.title}`} accessibilityRole="button" onPress={() => void openNotification(item)} className={`flex-row rounded-2xl border p-4 mb-3 ${item.is_read ? "border-border bg-card" : "border-primary/40 bg-primary/10"}`} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
        <View className={`w-10 h-10 rounded-xl items-center justify-center ${item.is_read ? "bg-secondary" : "bg-primary/15"}`}><Ionicons name={item.event.startsWith("payment.") ? "shield-checkmark-outline" : "cube-outline"} size={20} color={item.is_read ? (isDark ? "#cbd5e1" : "#68717e") : "#ef1b1b"} /></View>
        <View className="flex-1 ml-3"><View className="flex-row items-start gap-2"><Text className="flex-1 text-foreground text-sm font-semibold">{item.title}</Text>{!item.is_read && <View className="w-2 h-2 rounded-full bg-primary mt-1.5" />}</View><Text className="text-muted-foreground text-xs leading-5 mt-1">{item.body}</Text><Text className="text-muted-foreground text-[10px] uppercase tracking-[0.1em] mt-2">{new Date(item.occurred_at).toLocaleString("en-PH")}</Text></View>
      </Pressable>}
    />}
  </SafeAreaView>;
}
