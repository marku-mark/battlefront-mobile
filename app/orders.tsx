import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getOrderReturnRequests } from "@/lib/orderSupport";
import { getOrders, type OrderRecord } from "@/lib/orders";

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [returnRequestIds, setReturnRequestIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      Promise.all([getOrders(), getOrderReturnRequests()]).then(([loadedOrders, requests]) => {
        if (!isActive) return;
        setOrders(loadedOrders);
        setReturnRequestIds(requests.map((request) => request.orderId));
      });
      return () => {
        isActive = false;
      };
    }, []),
  );

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {orders.map((order) => (
          <Pressable
            key={order.id}
            accessibilityRole="button"
            className="mb-4 rounded-2xl border border-border bg-card p-4"
            onPress={() => router.push({ pathname: "/orders/[id]", params: { id: order.id } })}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-sm font-bold">{order.id}</Text>
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
        ))}
        {orders.length === 0 && <Text className="py-10 text-center text-muted-foreground text-sm">No orders to show.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
