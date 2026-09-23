import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { useState } from "react";
import type { Product } from "@/lib/data";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

type ProductCardProps = {
  product: Product;
  width?: number;
  onPress?: (product: Product) => void;
};

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export function ProductCard({ product, width = 150, onPress }: ProductCardProps) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);
  const wishlisted = isWishlisted(product.id);

  function handleQuickAdd() {
    addItem(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  }
  const hasDiscount =
    product.originalPrice !== undefined && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.originalPrice! - product.price) / product.originalPrice!) * 100
      )
    : 0;
  const isHotPick = hasDiscount || (product.sold !== undefined && product.sold > 120);

  return (
    <View style={{ width }} className="self-start">
      <View className="rounded-2xl overflow-hidden bg-card border border-border shadow-soft">
        <Pressable
          accessibilityLabel={`View details for ${product.name}`}
          onPress={() => onPress?.(product)}
          style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
        >
          <View className="relative">
            <Image
              source={{ uri: product.image }}
              style={{ width: "100%", height: width * 0.96 }}
              resizeMode="cover"
            />

            {hasDiscount && (
              <View className="absolute top-2 left-2 bg-ring rounded-full px-2 py-1">
                <Text className="text-primary-foreground text-[10px] font-bold uppercase tracking-[0.08em]">
                  -{discountPct}%
                </Text>
              </View>
            )}

            {!hasDiscount && isHotPick && (
              <View className="absolute top-2 left-2 bg-primary/90 rounded-full px-2 py-1">
                <Text className="text-primary-foreground text-[10px] font-bold uppercase tracking-[0.08em]">
                  Hot
                </Text>
              </View>
            )}
          </View>

          <View className="px-2.5 pt-2.5 pb-3">
            <Text numberOfLines={2} className="text-foreground text-[13px] font-semibold leading-4">
              {product.name}
            </Text>

            <View className="flex-row items-end gap-1.5 mt-2">
              <Text className="text-primary font-bold text-[15px]">
                {formatPrice(product.price)}
              </Text>
              {hasDiscount && (
                <Text className="text-muted-foreground text-[11px] line-through mb-[1px]">
                  {formatPrice(product.originalPrice!)}
                </Text>
              )}
            </View>

            <View className="flex-row items-center justify-between mt-1.5">
              {product.sold !== undefined ? (
                <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
                  {product.sold} sold
                </Text>
              ) : (
                <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
                  Ready to ship
                </Text>
              )}

              {hasDiscount && (
                <Text className="text-ring text-[10px] font-bold uppercase tracking-[0.12em]">
                  Save more
                </Text>
              )}
            </View>
          </View>
        </Pressable>

        <View className="flex-row items-center gap-2 px-2.5 pb-2.5">
          <Pressable
            accessibilityLabel={`${wishlisted ? "Remove" : "Add"} ${product.name} ${wishlisted ? "from" : "to"} wishlist`}
            accessibilityState={{ selected: wishlisted }}
            onPress={() => toggleWishlist(product.id)}
            className="w-9 h-9 rounded-lg border border-border items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <Ionicons
              name={wishlisted ? "heart" : "heart-outline"}
              size={18}
              color={wishlisted ? "#ef1b1b" : "#9ca3af"}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={`Add ${product.name} to cart`}
            onPress={handleQuickAdd}
            className="flex-1 h-9 rounded-lg bg-primary flex-row items-center justify-center gap-1.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name={justAdded ? "checkmark" : "cart-outline"} size={15} color="#f8fafc" />
            <Text className="text-primary-foreground text-[11px] font-bold">
              {justAdded ? "Added" : "Add"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
