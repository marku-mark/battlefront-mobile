import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useTheme } from "@/theme/ThemeProvider";
import { getResponsiveLayout } from "@/lib/responsive";

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  icon: "pricetag-outline" | "cube-outline" | "shield-checkmark-outline";
};

const demoNotifications: Notification[] = [
  {
    id: "deal-update",
    title: "Flash deals are live",
    message: "Save on selected GPUs, peripherals, and gaming monitors today.",
    time: "Just now",
    icon: "pricetag-outline",
  },
  {
    id: "support-update",
    title: "Warranty support is available",
    message: "Need help with a Battlefront purchase? Our support team is ready.",
    time: "Yesterday",
    icon: "shield-checkmark-outline",
  },
  {
    id: "store-update",
    title: "Store pickup is coming soon",
    message: "We are preparing faster pickup options for local branches.",
    time: "2 days ago",
    icon: "cube-outline",
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const { isDark } = useTheme();
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const unreadCount = demoNotifications.filter((item) => !readIds.includes(item.id)).length;

  function markAsRead(id: string) {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function retry() {
    setHasError(false);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}
        onBack={() => router.back()}
        right={unreadCount > 0 ? (
          <Pressable accessibilityLabel="Mark all notifications as read" onPress={() => setReadIds(demoNotifications.map((item) => item.id))} hitSlop={8}>
            <Text className="text-primary text-xs font-semibold">Mark all</Text>
          </Pressable>
        ) : undefined}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#ef1b1b" />
          <Text className="text-muted-foreground text-xs mt-3">Loading updates...</Text>
        </View>
      ) : hasError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="cloud-offline-outline" size={32} color={isDark ? "#9ca3af" : "#68717e"} />
          <Text className="text-foreground text-base font-semibold mt-3">Notifications are unavailable</Text>
          <Text className="text-muted-foreground text-sm text-center mt-2">Check your connection and try again.</Text>
          <Pressable onPress={retry} className="bg-primary rounded-xl px-5 py-3 mt-5">
            <Text className="text-primary-foreground text-sm font-semibold">Try again</Text>
          </Pressable>
        </View>
      ) : demoNotifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-secondary border border-border items-center justify-center">
            <Ionicons name="notifications-off-outline" size={34} color={isDark ? "#9ca3af" : "#68717e"} />
          </View>
          <Text className="text-foreground text-lg font-semibold mt-5">No notifications yet</Text>
          <Text className="text-muted-foreground text-sm text-center mt-2">Deals and order updates will appear here.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: layout.horizontalPadding, paddingBottom: 28, width: "100%", maxWidth: 760, alignSelf: "center" }}>
          {demoNotifications.map((notification) => {
            const isRead = readIds.includes(notification.id);
            return (
              <Pressable
                key={notification.id}
                accessibilityLabel={`${isRead ? "Read" : "Unread"} notification: ${notification.title}`}
                accessibilityState={{ selected: !isRead }}
                onPress={() => markAsRead(notification.id)}
                className={`flex-row rounded-2xl border p-4 mb-3 ${isRead ? "border-border bg-card" : "border-primary/40 bg-primary/10"}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <View className={`w-10 h-10 rounded-xl items-center justify-center ${isRead ? "bg-secondary" : "bg-primary/15"}`}>
                  <Ionicons name={notification.icon} size={20} color={isRead ? (isDark ? "#cbd5e1" : "#68717e") : "#ef1b1b"} />
                </View>
                <View className="flex-1 ml-3">
                  <View className="flex-row items-start gap-2">
                    <Text className="flex-1 text-foreground text-sm font-semibold">{notification.title}</Text>
                    {!isRead && <View className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
                  </View>
                  <Text className="text-muted-foreground text-xs leading-5 mt-1">{notification.message}</Text>
                  <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.1em] mt-2">{notification.time}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}