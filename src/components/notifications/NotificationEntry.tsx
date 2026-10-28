import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View } from "react-native";
import type { OrderNotification } from "@/lib/notifications";
import { useTheme } from "@/theme/ThemeProvider";

export function notificationGroupDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

export function NotificationEntry({ item, onPress, disabled = false, compact = false }: {
  item: OrderNotification;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const icon = item.event.startsWith("payment.") ? "card-outline" : item.event === "order.cancelled" ? "close-circle-outline" : "cube-outline";
  const category = item.event.startsWith("payment.") ? "Payment" : item.event === "order.cancelled" ? "Order" : "Delivery";
  const date = new Date(item.occurred_at);
  const time = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${item.is_read ? "Read" : "Unread"} ${category.toLowerCase()} update: ${item.title}. ${item.body}`}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    className={`flex-row border-b border-border ${compact ? "py-3" : "py-4"}`}
    style={({ pressed }) => ({ opacity: disabled ? 0.55 : pressed ? 0.7 : 1 })}
  >
    <View className={`h-9 w-9 items-center justify-center rounded-lg ${item.is_read ? "bg-secondary" : "bg-primary/10"}`}>
      <Ionicons name={icon} size={18} color={item.is_read ? colors.muted : colors.primary} />
    </View>
    <View className="ml-3 flex-1">
      <View className="flex-row items-center gap-2">
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{category}</Text>
        {time ? <Text className="text-muted-foreground text-xs">{time}</Text> : null}
        {!item.is_read && <View className="ml-auto h-2 w-2 rounded-full bg-primary" />}
      </View>
      <Text className={`mt-1 text-foreground text-sm ${item.is_read ? "font-medium" : "font-bold"}`} numberOfLines={compact ? 1 : 2}>{item.title}</Text>
      <Text className="mt-1 text-muted-foreground text-xs leading-5" numberOfLines={compact ? 2 : 3}>{item.body}</Text>
      {item.order?.reference ? <Text className="mt-1 text-muted-foreground text-xs">Order {item.order.reference}</Text> : null}
    </View>
  </Pressable>;
}
