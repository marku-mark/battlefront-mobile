import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import { getSessionRevision } from "@/lib/api";
import { getNotifications, markNotificationRead, type OrderNotification } from "@/lib/notifications";
import { useTheme } from "@/theme/ThemeProvider";
import { NotificationEntry } from "./NotificationEntry";

export function NotificationPreview({ visible, onClose, onViewAll }: { visible: boolean; onClose: () => void; onViewAll: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { colors } = useTheme();
  const { session } = useSession();
  const { setUnreadCount } = useNotifications();
  const { showToast } = useToast();
  const owner = session.mode === "customer" ? session.user.id : null;
  const [rows, setRows] = useState<OrderNotification[]>([]);
  const [loadedOwner, setLoadedOwner] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (owner === null) { setRows([]); setLoadedOwner(null); return; }
    const id = ++requestId.current;
    const revision = getSessionRevision();
    setLoading(true);
    setError(false);
    try {
      const result = await getNotifications();
      if (id !== requestId.current || revision !== getSessionRevision()) return;
      setRows(result.data.slice(0, 5));
      setLoadedOwner(owner);
      setUnreadCount(result.meta.unread_count);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [owner, setUnreadCount]);

  useEffect(() => {
    if (visible) void load();
    return () => { requestId.current++; };
  }, [visible, load]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void load(); });
    return () => subscription.remove();
  }, [visible, load]);

  async function open(item: OrderNotification) {
    if (openingId) return;
    const revision = getSessionRevision();
    setOpeningId(item.id);
    if (!item.is_read) {
      try {
        const result = await markNotificationRead(item.id);
        if (revision !== getSessionRevision()) return;
        setRows((current) => current.map((row) => row.id === item.id ? result.notification : row));
        setUnreadCount(result.unreadCount);
      } catch {
        if (revision === getSessionRevision()) showToast("Could not mark this update as read", "error");
      } finally {
        setOpeningId(null);
      }
    } else setOpeningId(null);
    if (revision !== getSessionRevision()) return;
    onClose();
    const link = item.order?.deep_link;
    if (link?.screen === "order_detail" && Number.isSafeInteger(link.order_id) && link.order_id > 0) router.push(`/orders/${link.order_id}`);
    else onViewAll();
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View className="flex-1">
      <Pressable className="absolute inset-0 bg-background/70" accessibilityLabel="Close notification preview" onPress={onClose} />
      <View accessibilityViewIsModal className="self-center max-w-[520px] overflow-hidden rounded-lg border border-border bg-card" style={{ marginTop: insets.top + 72, width: "92%", elevation: 12 }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text accessibilityRole="header" className="text-foreground text-base font-bold">Recent updates</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close notification preview" onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={21} color={colors.icon} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: Math.max(100, Math.min(350, height - insets.top - insets.bottom - 190)) }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {owner === null ? <Text className="py-8 text-center text-muted-foreground text-sm">Sign in to see your order updates.</Text>
            : loading && loadedOwner !== owner ? <ActivityIndicator className="my-8" color={colors.primary} />
            : error ? <Pressable accessibilityRole="button" onPress={() => void load()} className="py-8"><Text className="text-center text-muted-foreground text-sm">Could not load updates. Tap to retry.</Text></Pressable>
            : loadedOwner !== owner || rows.length === 0 ? <Text className="py-8 text-center text-muted-foreground text-sm">No order updates yet.</Text>
            : rows.map((item) => <NotificationEntry key={item.id} item={item} compact disabled={openingId !== null} onPress={() => void open(item)} />)}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => { onClose(); onViewAll(); }} className="min-h-12 items-center justify-center border-t border-border" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text className="text-primary text-sm font-semibold">View all notifications</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
