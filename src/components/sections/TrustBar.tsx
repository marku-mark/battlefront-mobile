import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

const items = [
  { icon: "shield-checkmark-outline", label: "Warranty" },
  { icon: "flash-outline", label: "Fast Shipping" },
  { icon: "lock-closed-outline", label: "Secure Payment" },
] as const;

export function TrustBar() {
  return (
    <View className="flex-row justify-between px-4 mt-6 py-3 border-t border-b border-border">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <Ionicons name={item.icon} size={14} color="#9ca3af" />
          <Text className="text-muted-foreground text-xs">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
