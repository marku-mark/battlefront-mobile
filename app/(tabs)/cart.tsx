import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { useCart, type CartItem } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { ConfirmClearModal } from "@/components/layout/ConfirmClearModal";
import { getProductImageSource } from "@/lib/data";

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export default function CartScreen() {
  const router = useRouter();
  const { items, subtotal, addItem, updateQuantity, removeItem, clearCart, isLoading: isCartLoading } = useCart();
  const { session, isHydrated } = useSession();
  const [removedItem, setRemovedItem] = useState<CartItem | null>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const shippingFee = subtotal > 5000 ? 0 : 150;
  const total = subtotal + shippingFee;

  if (!isHydrated || isCartLoading) {
    return (
      <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
        <ScreenHeader title="Your Cart" />
        <LoadingState label="Loading your cart..." />
      </SafeAreaView>
    );
  }

  if (items.length === 0 && !removedItem) {
    return (
      <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
        <ScreenHeader
          title="Your Cart"
          right={
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
              <Text className="text-muted-foreground text-xs">Checkout preview</Text>
            </View>
          }
        />

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
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader
        title="Your Cart"
        right={
          <Pressable
            accessibilityLabel="Clear cart"
            onPress={() => setIsClearConfirmOpen(true)}
            hitSlop={8}
          >
            <Text className="text-primary text-xs font-semibold">Clear all</Text>
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-soft">
          <View className="flex-row items-center justify-between">
            <Text className="text-foreground text-sm font-semibold">Order summary</Text>
            <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
              {items.length} items
            </Text>
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons name="checkmark-circle-outline" size={15} color="#ef4444" />
            <Text className="text-muted-foreground text-xs">
              {subtotal >= 5000 ? "Free shipping unlocked" : `Add ${formatPrice(5000 - subtotal)} more for free shipping`}
            </Text>
          </View>
        </View>

        {items.map(({ product, quantity, variant }) => (
          <View key={product.id} className="flex-row bg-card border border-border rounded-2xl p-3 mb-3 shadow-soft">
            <Pressable
              accessibilityLabel={`View details for ${product.name}`}
              onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
            >
              <Image source={getProductImageSource(product.image)} className="w-20 h-20 rounded-xl bg-secondary" />
            </Pressable>
            <View className="flex-1 ml-3">
              <View className="flex-row items-start gap-2">
                <Pressable
                  accessibilityLabel={`View details for ${product.name}`}
                  onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
                  className="flex-1"
                >
                  <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>{product.name}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Remove ${product.name}`}
                  onPress={() => {
                    setRemovedItem({ product, quantity, variant });
                    removeItem(product.id, variant);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={17} color="#94a3b8" />
                </Pressable>
              </View>
              {variant && <Text className="text-muted-foreground text-xs mt-1">Option: {variant}</Text>}
              <Text className="text-primary text-sm font-bold mt-2">{formatPrice(product.price)}</Text>
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center border border-border rounded-xl overflow-hidden bg-secondary">
                  <Pressable
                    accessibilityLabel={`Decrease ${product.name} quantity`}
                    onPress={() => updateQuantity(product.id, quantity - 1, variant)}
                    className="w-8 h-8 items-center justify-center"
                  >
                    <Ionicons name="remove" size={14} color="#f8fafc" />
                  </Pressable>
                  <Text className="text-foreground text-xs font-bold min-w-[34px] text-center">{quantity}</Text>
                  <Pressable
                    accessibilityLabel={`Increase ${product.name} quantity`}
                    onPress={() => updateQuantity(product.id, quantity + 1, variant)}
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

        {removedItem && (
          <View className="flex-row items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 mb-3">
            <Text className="flex-1 text-foreground text-xs">{removedItem.product.name} removed</Text>
            <Pressable
              accessibilityLabel="Undo remove item"
              onPress={() => {
                addItem(removedItem.product, removedItem.quantity, removedItem.variant);
                setRemovedItem(null);
              }}
              className="px-2 py-1"
            >
              <Text className="text-primary text-xs font-bold">Undo</Text>
            </Pressable>
          </View>
        )}

        <View className="bg-card border border-border rounded-2xl p-4 mt-2 shadow-soft">
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted-foreground text-sm">Subtotal</Text>
            <Text className="text-foreground text-base font-bold">{formatPrice(subtotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted-foreground text-sm">Shipping</Text>
            <Text className="text-foreground text-sm">{shippingFee === 0 ? "FREE" : formatPrice(shippingFee)}</Text>
          </View>
          <View className="border-t border-border pt-3 mt-1 flex-row justify-between">
            <Text className="text-foreground text-base font-bold">Total</Text>
            <Text className="text-primary text-base font-bold">{formatPrice(total)}</Text>
          </View>
          <Text className="text-muted-foreground text-xs mt-3">Guests can review their cart. Sign in to continue to the checkout preview; no real order or payment is submitted.</Text>
          <Pressable
            onPress={() => session.mode === "mock-account" ? router.push("/checkout") : setIsSignInOpen(true)}
            disabled={items.length === 0}
            className="bg-primary rounded-xl items-center py-3.5 mt-5"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-primary-foreground text-sm font-bold">
              {session.mode === "mock-account" ? "Continue to checkout" : "Sign in to continue"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <MockSignInSheet
        visible={isSignInOpen}
        message="Sign in to continue. Your guest cart will move into the local demo account."
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => router.push("/checkout")}
      />
      <ConfirmClearModal
        visible={isClearConfirmOpen}
        title="Clear cart?"
        description={`This will remove all ${items.length} ${items.length === 1 ? "item" : "items"} from your cart.`}
        detail="You can add products to your cart again at any time."
        confirmLabel="Clear cart"
        onCancel={() => setIsClearConfirmOpen(false)}
        onConfirm={() => {
          clearCart();
          setRemovedItem(null);
          setIsClearConfirmOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
