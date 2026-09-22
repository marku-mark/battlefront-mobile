import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

const items = [
  { icon: "shield-checkmark-outline", label: "Warranty" },
  { icon: "flash-outline", label: "Fast Shipping" },
  { icon: "lock-closed-outline", label: "Secure Payment" },
] as const;

export function TrustBar() {
  const { isDark } = useTheme();

  return (
    <View className="mx-4 mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <View className="flex-row px-3 py-3.5">
        {items.map((item, index) => (
          <View
            key={item.label}
            className={`flex-1 flex-row items-center justify-center gap-1.5 ${index > 0 ? "border-l border-border" : ""}`}
          >
            <Ionicons name={item.icon} size={15} color={isDark ? "#cbd5e1" : "#68717e"} />
            <Text className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.08em]">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
