import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type HeaderProps = {
  cartCount?: number;
  onCartPress?: () => void;
  onSearchPress?: () => void;
};

export function Header({ cartCount = 0, onCartPress, onSearchPress }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-background border-b border-border"
    >
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Text className="text-foreground text-lg font-bold tracking-tight">
          BATTLEFRONT
        </Text>

        <Pressable
          onPress={onSearchPress}
          className="flex-1 flex-row items-center gap-2 bg-secondary rounded-md px-3 py-2"
        >
          <Ionicons name="search-outline" size={16} color="#9ca3af" />
          <Text className="text-muted-foreground text-sm">
            Search parts, brands, builds
          </Text>
        </Pressable>

        <Pressable
          onPress={onCartPress}
          className="relative w-9 h-9 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="cart-outline" size={22} color="#f8fafc" />
          {cartCount > 0 && (
            <View className="absolute -top-0.5 -right-0.5 bg-ring rounded-full min-w-[16px] h-4 items-center justify-center px-1">
              <Text className="text-[10px] text-foreground font-semibold">
                {cartCount > 99 ? "99+" : cartCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
