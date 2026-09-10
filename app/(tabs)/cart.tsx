import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CartScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-3 pb-4 border-b border-border">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground text-2xl font-bold">Your Cart</Text>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="shield-checkmark-outline" size={16} color="#9ca3af" />
            <Text className="text-muted-foreground text-xs">Secure checkout</Text>
          </View>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center">
          <Ionicons name="cart-outline" size={38} color="#9ca3af" />
        </View>
        <Text className="text-foreground text-lg font-semibold mt-5">
          Your cart is empty
        </Text>
        <Text className="text-muted-foreground text-sm text-center mt-2 max-w-[280px]">
          Add parts, peripherals, and upgrades to see them here.
        </Text>
        <Pressable
          onPress={() => router.replace("/")}
          className="bg-primary rounded-md px-5 py-3 mt-6"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-primary-foreground text-sm font-semibold">
            Browse products
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
