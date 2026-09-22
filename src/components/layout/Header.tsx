import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

type HeaderProps = {
  cartCount?: number;
  onCartPress?: () => void;
  onSearchPress?: () => void;
};

export function Header({ cartCount = 0, onCartPress, onSearchPress }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-background border-b border-border"
    >
      <View className="flex-row items-center gap-3 px-4 py-3.5">
        <Text className="text-foreground text-[17px] font-bold tracking-tight">
          BATTLEFRONT
        </Text>

        <Pressable
          onPress={onSearchPress}
          accessibilityLabel="Search products"
          className="flex-1 flex-row items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Ionicons name="search-outline" size={16} color={isDark ? "#cbd5e1" : "#68717e"} />
          <Text className="text-muted-foreground text-sm">
            Search parts, brands, builds
          </Text>
        </Pressable>

        <Pressable
          onPress={onCartPress}
          accessibilityLabel={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
          className="relative w-9 h-9 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="cart-outline" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
          {cartCount > 0 && (
            <View className="absolute -top-0.5 -right-0.5 bg-ring rounded-full min-w-[16px] h-4 items-center justify-center px-1">
              <Text className="text-[10px] text-primary-foreground font-bold">
                {cartCount > 99 ? "99+" : cartCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
