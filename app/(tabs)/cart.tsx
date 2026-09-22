import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "@/hooks/useCart";

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export default function CartScreen() {
  const router = useRouter();
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-3 pb-4 border-b border-border bg-background">
          <View className="flex-row items-center justify-between">
            <Text className="text-foreground text-2xl font-bold">Your Cart</Text>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="shield-checkmark-outline" size={16} color="#94a3b8" />
              <Text className="text-muted-foreground text-xs">Secure checkout</Text>
            </View>
          </View>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center border border-border">
            <Ionicons name="cart-outline" size={38} color="#94a3b8" />
          </View>
          <Text className="text-foreground text-lg font-semibold mt-5">Your cart is empty</Text>
          <Text className="text-muted-foreground text-sm text-center mt-2 max-w-[280px]">
            Add parts, peripherals, and upgrades to see them here.
          </Text>
          <Pressable
            onPress={() => router.replace("/")}
            className="bg-primary rounded-xl px-5 py-3 mt-6"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-primary-foreground text-sm font-semibold">Browse products</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-3 pb-4 border-b border-border bg-background">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground text-2xl font-bold">Your Cart</Text>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="shield-checkmark-outline" size={16} color="#94a3b8" />
            <Text className="text-muted-foreground text-xs">Secure checkout</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {items.map(({ product, quantity }) => (
          <View key={product.id} className="flex-row bg-card border border-border rounded-2xl p-3 mb-3">
            <Image source={{ uri: product.image }} className="w-20 h-20 rounded-xl bg-secondary" />
            <View className="flex-1 ml-3">
              <View className="flex-row items-start gap-2">
                <Text className="flex-1 text-foreground text-sm font-semibold" numberOfLines={2}>
                  {product.name}
                </Text>
                <Pressable
                  accessibilityLabel={`Remove ${product.name}`}
                  onPress={() => removeItem(product.id)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={17} color="#94a3b8" />
                </Pressable>
              </View>
              <Text className="text-primary text-sm font-bold mt-2">{formatPrice(product.price)}</Text>
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center border border-border rounded-xl overflow-hidden bg-secondary">
                  <Pressable
                    accessibilityLabel={`Decrease ${product.name} quantity`}
                    onPress={() => updateQuantity(product.id, quantity - 1)}
                    className="w-8 h-8 items-center justify-center"
                  >
                    <Ionicons name="remove" size={14} color="#f8fafc" />
                  </Pressable>
                  <Text className="text-foreground text-xs font-bold min-w-[34px] text-center">{quantity}</Text>
                  <Pressable
                    accessibilityLabel={`Increase ${product.name} quantity`}
                    onPress={() => updateQuantity(product.id, quantity + 1)}
                    className="w-8 h-8 items-center justify-center"
                  >
                    <Ionicons name="add" size={14} color="#f8fafc" />
                  </Pressable>
                </View>
                <Text className="text-foreground text-sm font-semibold">{formatPrice(product.price * quantity)}</Text>
              </View>
            </View>
          </View>
        ))}

        <View className="bg-card border border-border rounded-2xl p-4 mt-2">
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground text-sm">Subtotal</Text>
            <Text className="text-foreground text-base font-bold">{formatPrice(subtotal)}</Text>
          </View>
          <Text className="text-muted-foreground text-xs mt-3">Shipping and taxes are calculated at checkout.</Text>
          <Pressable
            onPress={() => router.push("/checkout")}
            className="bg-primary rounded-xl items-center py-3.5 mt-5"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-primary-foreground text-sm font-bold">Continue to checkout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
