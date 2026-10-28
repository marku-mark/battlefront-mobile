import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import { getSessionRevision } from "@/lib/api";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type OrderNotification } from "@/lib/notifications";
import { getResponsiveLayout } from "@/lib/responsive";
import { useTheme } from "@/theme/ThemeProvider";
import { NotificationEntry, notificationGroupDate } from "@/components/notifications/NotificationEntry";

export default function NotificationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const { isDark } = useTheme();
  const { session } = useSession();
  const owner = session.mode === "customer" ? session.user.id : null;
  const { showToast } = useToast();
  const { unreadCount, setUnreadCount } = useNotifications();
  const [loadedOwner, setLoadedOwner] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
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
    if (readingId !== null || isMarkingAll) return;
    const revision = getSessionRevision();
    if (!notification.is_read) {
      setReadingId(notification.id);
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
        if (revision === getSessionRevision()) {
          setError(failure instanceof Error ? failure.message : "Could not mark notification as read.");
          showToast("Could not mark this update as read", "error");
        }
      } finally {
        setReadingId(null);
      }
    }
    const link = notification.order?.deep_link;
    if (link?.screen === "order_detail" && Number.isSafeInteger(link.order_id) && link.order_id > 0 && owner !== null && revision === getSessionRevision()) {
      router.push(`/orders/${link.order_id}`);
    } else if (revision === getSessionRevision()) {
      showToast("This update has no linked order", "info");
    }
  }

  async function markAll() {
    if (isMarkingAll || readingId !== null) return;
    const revision = getSessionRevision();
    setIsMarkingAll(true);
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
      if (revision === getSessionRevision()) {
        setError(failure instanceof Error ? failure.message : "Could not mark notifications as read.");
        showToast("Could not mark notifications as read", "error");
      }
    } finally {
      setIsMarkingAll(false);
    }
  }

  const rows = owner !== null && loadedOwner === owner ? notifications : [];
  const sections = useMemo(() => {
    const grouped: { title: string; data: OrderNotification[] }[] = [];
    for (const item of rows) {
      const title = notificationGroupDate(item.occurred_at);
      const section = grouped.find((group) => group.title === title);
      if (section) section.data.push(item);
      else grouped.push({ title, data: [item] });
    }
    return grouped;
  }, [rows]);
  return <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
    <ScreenHeader title="Notifications" subtitle={owner === null ? "Sign in to see order updates" : unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"} onBack={() => router.back()} right={<View className="flex-row items-center gap-3">
      {owner !== null && loadedOwner === owner && !isLoading && unreadCount > 0 ? <Pressable accessibilityLabel="Mark all notifications as read" accessibilityRole="button" accessibilityState={{ disabled: isMarkingAll }} disabled={isMarkingAll} onPress={() => void markAll()} hitSlop={8} style={({ pressed }) => ({ opacity: isMarkingAll ? 0.55 : pressed ? 0.7 : 1 })}><Text className="text-primary text-xs font-semibold">{isMarkingAll ? "Marking..." : "Mark all"}</Text></Pressable> : null}
      <Pressable accessibilityLabel="Manage push notification settings" accessibilityRole="button" onPress={() => router.push("/notification-settings")} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary"><Ionicons name="settings-outline" size={17} color={isDark ? "#f8fafc" : "#30343b"} /></Pressable>
    </View>} />
    {error && <Pressable accessibilityRole="button" accessibilityLabel={`${error}. Tap to retry.`} onPress={() => void loadFirst(true)} className="mx-4 mt-3 rounded-lg border border-primary/40 bg-primary/10 p-3" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}><Text className="text-foreground text-xs">{error} Tap to retry.</Text></Pressable>}
    {isLoading && rows.length === 0 ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#ef1b1b" /><Text className="text-muted-foreground text-xs mt-3">Loading updates...</Text></View> : <SectionList
      sections={sections} keyExtractor={(item) => item.id} refreshing={isRefreshing} onRefresh={() => void loadFirst(true)} onEndReached={() => void loadMore()} onEndReachedThreshold={0.4}
      contentContainerStyle={{ padding: layout.horizontalPadding, paddingBottom: 28, width: "100%", maxWidth: 760, alignSelf: "center", flexGrow: 1 }}
      ListEmptyComponent={<View className="flex-1 items-center justify-center px-6"><View className="w-20 h-20 rounded-full bg-secondary border border-border items-center justify-center"><Ionicons name={error ? "cloud-offline-outline" : "notifications-off-outline"} size={34} color={isDark ? "#9ca3af" : "#68717e"} /></View><Text className="text-foreground text-lg font-semibold mt-5">{owner === null ? "Sign in for updates" : error ? "Notifications unavailable" : "No notifications yet"}</Text><Text className="mt-2 text-center text-muted-foreground text-sm leading-5">{owner === null ? "Order and delivery updates appear here after you sign in." : error ? "Check your connection and try again." : "Payment and delivery updates will appear here."}</Text>{owner === null ? <Pressable accessibilityRole="button" onPress={() => router.push("/account")} className="mt-5 min-h-11 justify-center rounded-lg bg-primary px-5"><Text className="text-primary-foreground text-sm font-semibold">Go to account</Text></Pressable> : null}</View>}
      ListFooterComponent={isLoadingMore ? <ActivityIndicator color="#ef1b1b" /> : null}
      renderSectionHeader={({ section }) => <Text accessibilityRole="header" className="bg-background pb-1 pt-5 text-muted-foreground text-xs font-bold uppercase tracking-wide">{section.title}</Text>}
      renderItem={({ item }) => <NotificationEntry item={item} disabled={readingId !== null || isMarkingAll} onPress={() => void openNotification(item)} />}
    />}
  </SafeAreaView>;
}
