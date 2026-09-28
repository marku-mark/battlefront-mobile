import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useCart } from "@/hooks/useCart";
import { useTheme } from "@/theme/ThemeProvider";

export default function TabsLayout() {
  const { itemCount } = useCart();
  const { isDark } = useTheme();
  const activeColor = isDark ? "#ef1b1b" : "#ab2923";
  const inactiveColor = isDark ? "#9ca3af" : "#59616d";
  const backgroundColor = isDark ? "#090b10" : "#fffaf6";
  const borderColor = isDark ? "#2a2e36" : "#d5cec5";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor,
          borderTopColor: borderColor,
          borderTopWidth: 1,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="builder"
        options={{
          title: "Builder",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarBadge: itemCount > 0 ? (itemCount > 99 ? "99+" : itemCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: activeColor,
            color: "#f8fafc",
            minWidth: 18,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={String(color)} />
          ),
        }}
      />
    </Tabs>
  );
}
