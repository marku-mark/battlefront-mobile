import { useActiveFocusEffect, useScreenActive } from "@/hooks/useActiveScreen";
import { useSession } from "@/hooks/useSession";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getOrderReturnRequests } from "@/lib/orderSupport";
import { getOrders, getOrdersSnapshot, subscribeOrders, getOrdersPageSnapshot, loadNextOrdersPage, type OrderRecord } from "@/lib/orders";

export default function OrdersScreen() {
  const router = useRouter();
  const isScreenActive = useScreenActive();
  const { session } = useSession();
  const owner = session.mode === "customer" ? session.user.id : null;
  const [loadedOwner, setLoadedOwner] = useState(owner);
  const [orders, setOrders] = useState<OrderRecord[]>(() => getOrdersSnapshot() ?? []);
  const [returnRequestIds, setReturnRequestIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !getOrdersSnapshot());
  const [refreshing, setRefreshing] = useState(false);

  useActiveFocusEffect(
    useCallback(() => {
      let isActive = true;
      setLoadedOwner(owner);
      const cached = getOrdersSnapshot();
      setOrders(cached ?? []); setLoading(!cached); setError(null);
      if (owner === null) { setLoading(false); return; }
      const unsubscribe = subscribeOrders((snapshot) => {
        if (!isActive) return;
        setOrders(snapshot.rows); setLoading(snapshot.loading);
        setError(snapshot.error?.message ?? null);
      });
      Promise.all([getOrders(), getOrderReturnRequests()]).then(([, requests]) => {
        if (!isActive) return;
        setReturnRequestIds(requests.map((request) => request.orderId));
      }).catch((failure) => { if (isActive) setError(failure instanceof Error ? failure.message : "Cannot load orders."); });
      return () => {
        isActive = false;
        unsubscribe();
      };
    }, [owner]),
  );
  const loadMore = useCallback(() => {
    const snapshot = getOrdersPageSnapshot();
    if (owner !== null && isScreenActive() && !snapshot.loading && !snapshot.complete && !snapshot.error) void loadNextOrdersPage().catch(() => undefined);
  }, [owner, isScreenActive]);
  async function refresh() {
    if (owner === null || refreshing || !isScreenActive()) return;
    setRefreshing(true);
    try { await getOrders(true); }
    catch { /* The subscribed pager exposes the error while keeping visible orders. */ }
    finally { setRefreshing(false); }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable
          accessibilityLabel="Go back from orders"
          onPress={() => router.back()}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#f8fafc" />
        </Pressable>
        <Text className="text-foreground text-lg font-semibold ml-2">My orders</Text>
      </View>

      <FlatList refreshing={refreshing} onRefresh={() => void refresh()} onEndReached={loadMore} onEndReachedThreshold={0.4} data={owner !== null && loadedOwner === owner ? orders : []} keyExtractor={(order) => order.id} initialNumToRender={8} maxToRenderPerBatch={6} windowSize={5} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} renderItem={({ item: order }) => (
          <Pressable
            key={order.id}
            accessibilityRole="button"
            className="mb-4 rounded-2xl border border-border bg-card p-4"
            onPress={() => router.push({ pathname: "/orders/[id]", params: { id: order.id } })}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-sm font-bold">{order.reference}</Text>
              <View className="rounded-full bg-primary/10 px-2 py-1">
                <Text className="text-primary text-[10px] font-bold uppercase tracking-[0.08em]">{returnRequestIds.includes(order.id) ? "Return requested" : order.status}</Text>
              </View>
            </View>

            <Text className="text-muted-foreground text-xs mt-3">Placed {order.date}</Text>
            <Text className="text-foreground text-sm mt-2">{order.items}</Text>
            <Text className="text-primary text-sm font-bold mt-3">{order.total}</Text>

            <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-border">
              <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">Track order</Text>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </View>
          </Pressable>
        )} ListFooterComponent={<View>
        {error && <View><Text className="py-4 text-center text-primary">{error}</Text><Pressable disabled={loading} onPress={() => void (orders.length ? loadNextOrdersPage() : getOrders(true)).catch(() => undefined)} className="min-h-12 justify-center"><Text className="text-primary text-center">Retry loading orders</Text></Pressable></View>}
        {loading && <Text className="py-4 text-center text-muted-foreground">Loading orders…</Text>}
        {!loading && !error && orders.length === 0 && <Text className="py-10 text-center text-muted-foreground text-sm">No orders to show.</Text>}
      </View>} />
    </SafeAreaView>
  );
}
