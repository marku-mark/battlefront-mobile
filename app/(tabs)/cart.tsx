import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { useCart, type CartItem } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { useWishlist } from "@/hooks/useWishlist";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { ConfirmClearModal } from "@/components/layout/ConfirmClearModal";

import { getProductImageSource } from "@/lib/data";
import { getResponsiveLayout } from "@/lib/responsive";

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export default function CartScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const { items, itemCount, subtotal, addItem, updateQuantity, removeItem, clearCart, refreshCart, conflictCount, error, isUpdating, isLoading: isCartLoading } = useCart();
  const { session, isHydrated } = useSession();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [removedItem, setRemovedItem] = useState<CartItem | null>(null);
  const [removedItemAction, setRemovedItemAction] = useState<"removed" | "saved">("removed");
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const total = subtotal;
  const actionPending = useRef(false);
  const customerId = session.mode === "customer" ? session.user.id : null;
  const customerRef = useRef(customerId);
  customerRef.current = customerId;
  useEffect(() => { setRemovedItem(null); setIsClearConfirmOpen(false); }, [customerId]);
  async function runAction(action: () => Promise<boolean>, onSuccess?: () => void) {
    if (actionPending.current || isUpdating) return;
    actionPending.current = true;
    const owner = customerId;
    try { if (await action() && customerRef.current === owner) onSuccess?.(); }
    finally { actionPending.current = false; }
  }
  const signInSheet = <MockSignInSheet visible={isSignInOpen} message="Sign in with your Battlefront customer account." onClose={() => setIsSignInOpen(false)} />;

  if (error && items.length === 0 && !isCartLoading) {
    return <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader title="Your Cart" />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-foreground text-lg font-semibold">Cannot load your cart</Text>
        <Text className="text-muted-foreground text-sm text-center mt-2">{error}</Text>
        <Pressable disabled={isUpdating} onPress={() => void refreshCart().catch(() => undefined)} className="bg-primary rounded-xl px-5 py-3 mt-6"><Text className="text-primary-foreground">{isUpdating ? "Retrying…" : "Retry"}</Text></Pressable>
      </View>
    </SafeAreaView>;
  }

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
              <Text className="text-muted-foreground text-xs">Checkout</Text>
            </View>
          }
        />

        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center border border-border">
            <Ionicons name="cart-outline" size={38} color="#94a3b8" />
          </View>
          <Text className="text-foreground text-lg font-semibold mt-5">Your cart is empty</Text>
          <Text className="text-muted-foreground text-sm text-center mt-2 max-w-[280px]">
            {session.mode === "guest" ? "Sign in to add products and load your saved cart." : "Add parts, peripherals, and upgrades to see them here."}
          </Text>
          {session.mode === "guest" && <Pressable onPress={() => setIsSignInOpen(true)} className="bg-primary rounded-xl px-5 py-3 mt-6"><Text className="text-primary-foreground font-semibold">Sign in</Text></Pressable>}
          <Pressable
            onPress={() => router.replace("/")}
            className="bg-primary rounded-xl px-5 py-3 mt-6"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-primary-foreground text-sm font-semibold">Browse products</Text>
          </Pressable>
        </View>
        {signInSheet}
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
            disabled={isUpdating || items.length === 0}
            onPress={() => setIsClearConfirmOpen(true)}
            hitSlop={8}
          >
            <Text className="text-primary text-xs font-semibold">Clear all</Text>
          </Pressable>
        }
      />

      <ScrollView refreshControl={<RefreshControl refreshing={isUpdating} onRefresh={() => void refreshCart().catch(() => undefined)} tintColor="#ef1b1b" />} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: layout.horizontalPadding, paddingBottom: 28, width: "100%", maxWidth: 800, alignSelf: "center" }}>
        {error && <Text className="text-danger mb-3">{error}</Text>}
        {isUpdating && <View className="flex-row items-center gap-2 mb-3"><ActivityIndicator size="small" color="#ef1b1b" /><Text className="text-muted-foreground text-xs">Updating cart…</Text></View>}
        {conflictCount > 0 && <Text className="text-danger mb-3">Some items are unavailable or exceed current stock. Update or remove them before checkout.</Text>}
        <View className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-soft">
          <View className="flex-row items-center justify-between">
            <Text className="text-foreground text-sm font-semibold">Order summary</Text>
            <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </Text>
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons name="checkmark-circle-outline" size={15} color="#ef4444" />
            <Text className="text-muted-foreground text-xs">
              Prices and availability are checked by Battlefront.
            </Text>
          </View>
        </View>

        {items.map(({ product, quantity, variant, lineTotal }) => (
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
                  disabled={isUpdating}
                  onPress={() => void runAction(() => removeItem(product.id, variant), () => {
                    setRemovedItemAction("removed");
                    setRemovedItem({ product, quantity, variant, lineTotal });
                  })}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={17} color="#94a3b8" />
                </Pressable>
              </View>
              {variant && <Text className="text-muted-foreground text-xs mt-1">Option: {variant}</Text>}
              <Text className="text-primary text-sm font-bold mt-2">{formatPrice(product.price)}</Text>
              {product.availability !== "available" && <Text className="text-danger text-xs mt-1">{product.availability === "insufficient_stock" ? `Only ${product.stockQuantity ?? 0} available; reduce quantity.` : "Currently unavailable"}</Text>}
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center border border-border rounded-xl overflow-hidden bg-secondary">
                  <Pressable
                    accessibilityLabel={`Decrease ${product.name} quantity`}
                    disabled={isUpdating}
                    onPress={() => void runAction(() => updateQuantity(product.id, quantity - 1, variant))}
                    className="w-8 h-8 items-center justify-center"
                  >
                    <Ionicons name="remove" size={14} color="#f8fafc" />
                  </Pressable>
                  <Text className="text-foreground text-xs font-bold min-w-[34px] text-center">{quantity}</Text>
                  <Pressable
                    accessibilityLabel={`Increase ${product.name} quantity`}
                    accessibilityState={{ disabled: isUpdating || product.availability !== "available" || quantity >= (product.stockQuantity ?? 0) }}
                    disabled={isUpdating || product.availability !== "available" || quantity >= (product.stockQuantity ?? 0)}
                    onPress={() => void runAction(() => updateQuantity(product.id, quantity + 1, variant))}
                    className="w-8 h-8 items-center justify-center"
                    style={({ pressed }) => ({ opacity: isUpdating || product.availability !== "available" || quantity >= (product.stockQuantity ?? 0) ? 0.4 : pressed ? 0.7 : 1 })}
                  >
                    <Ionicons name="add" size={14} color="#f8fafc" />
                  </Pressable>
                </View>
                <Text className="text-foreground text-sm font-semibold">{formatPrice(lineTotal)}</Text>
              </View>
              <View className="mt-2 flex-row justify-end">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Save ${product.name} for later`}
                  disabled={isUpdating}
                  onPress={() => void runAction(() => removeItem(product.id, variant), () => {
                    if (!isWishlisted(product.id)) toggleWishlist(product.id);
                    setRemovedItemAction("saved");
                    setRemovedItem({ product, quantity, variant, lineTotal });
                  })}
                  className="flex-row items-center gap-1.5 px-1 py-1"
                  hitSlop={6}
                >
                  <Ionicons name="heart-outline" size={15} color="#ef1b1b" />
                  <Text className="text-primary text-xs font-semibold">Save for later</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {removedItem && (
          <View className="flex-row items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 mb-3">
            <Text className="flex-1 text-foreground text-xs">
              {removedItem.product.name} {removedItemAction === "saved" ? "saved for later" : "removed"}
            </Text>
            <Pressable
              accessibilityLabel="Undo remove item"
              disabled={isUpdating}
              onPress={() => void runAction(() => addItem(removedItem.product, removedItem.quantity, removedItem.variant), () => setRemovedItem(null))}
              className="px-2 py-1"
            >
              <Text className="text-primary text-xs font-bold">Undo</Text>
            </Pressable>
          </View>
        )}

        <View className="bg-card border border-border rounded-2xl p-4 mt-4 shadow-soft">
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted-foreground text-sm">Subtotal</Text>
            <Text className="text-foreground text-base font-bold">{formatPrice(subtotal)}</Text>
          </View>
          <View className="border-t border-border pt-3 mt-1 flex-row justify-between">
            <Text className="text-foreground text-base font-bold">Total</Text>
            <Text className="text-primary text-base font-bold">{formatPrice(total)}</Text>
          </View>
          <Text className="text-muted-foreground text-xs mt-3">Your order is submitted to Battlefront when you confirm checkout.</Text>
          <Pressable
            onPress={() => session.mode === "customer"
              ? router.push("/checkout")
              : setIsSignInOpen(true)}
            disabled={items.length === 0 || isUpdating || conflictCount > 0 || !!error}
            className="bg-primary rounded-xl items-center py-3.5 mt-5"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-primary-foreground text-sm font-bold">
              {session.mode === "customer" ? "Continue to checkout" : "Sign in to continue"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <ConfirmClearModal
        visible={isClearConfirmOpen}
        title="Clear cart?"
        description={`This will remove all ${items.length} ${items.length === 1 ? "item" : "items"} from your cart.`}
        detail="You can add products to your cart again at any time."
        confirmLabel="Clear cart"
        onCancel={() => setIsClearConfirmOpen(false)}
        onConfirm={() => {
          setIsClearConfirmOpen(false);
          void runAction(clearCart, () => setRemovedItem(null));
        }}
      />
      {signInSheet}
    </SafeAreaView>
  );
}
