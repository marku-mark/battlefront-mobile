import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Pressable, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { getProductImageSource, getProductVariants, type Product } from "@/lib/data";
import { useCartActions } from "@/hooks/useCart";
import { useIsWishlisted, useWishlistActions } from "@/hooks/useWishlist";
import { prefetchProductById } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";

type ProductCardProps = {
  product: Product;
  width?: number;
  onPress?: (product: Product) => void;
};

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export function ProductCard({ product, width = 150, onPress }: ProductCardProps) {
  const { addItem } = useCartActions();
  const toggleWishlist = useWishlistActions();
  const { colors } = useTheme();
  const [justAdded, setJustAdded] = useState(false);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlisted = useIsWishlisted(product.id);

  useEffect(() => () => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
  }, []);

  function handleQuickAdd() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    addItem(product, 1, variants[0] ?? null);
    setJustAdded(true);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => {
      setJustAdded(false);
      feedbackTimeout.current = null;
    }, 1400);
  }
  const hasDiscount =
    product.originalPrice !== undefined && product.originalPrice > product.price;
  const rating = product.rating ?? 4.8;
  const reviewCount = product.reviewCount ?? 24;
  const stockQuantity = product.stockQuantity ?? 12;
  const variants = getProductVariants(product);
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
          accessibilityRole="button"
          accessibilityHint="Opens product details"
          onPressIn={() => prefetchProductById(product.id)}
          onPress={() => onPress?.(product)}
          style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
        >
          <View className="relative">
            <ExpoImage
              source={getProductImageSource(product.image)}
              recyclingKey={product.id}
              accessibilityLabel={`${product.name} product image`}
              accessible
              style={{ width: "100%", height: width * 0.96 }}
              contentFit="cover"
              cachePolicy="memory-disk"
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

            <View className="flex-row items-center justify-between mt-1.5 gap-2">
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text className="text-foreground text-[10px] font-semibold">{rating.toFixed(1)}</Text>
                <Text className="text-muted-foreground text-[10px]">({reviewCount})</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <View className={`h-1.5 w-1.5 rounded-full ${stockQuantity > 0 ? "bg-success" : "bg-danger"}`} />
                <Text className={`text-[10px] uppercase tracking-[0.08em] ${stockQuantity > 0 ? "text-muted-foreground" : "text-danger"}`}>
                  {stockQuantity > 0 ? `${stockQuantity} in stock` : "Out of stock"}
                </Text>
              </View>
            </View>
            {variants.length > 0 && (
              <Text className="text-muted-foreground text-[10px] mt-1.5" numberOfLines={1}>
                Options: {variants.join(" • ")}
              </Text>
            )}
          </View>
        </Pressable>

        <View className="flex-row items-center gap-2 px-2.5 pb-2.5">
          <Pressable
            accessibilityLabel={`${wishlisted ? "Remove" : "Add"} ${product.name} ${wishlisted ? "from" : "to"} wishlist`}
            accessibilityRole="button"
            accessibilityState={{ selected: wishlisted }}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              toggleWishlist(product.id);
            }}
            className="w-9 h-9 rounded-lg border border-border items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <Ionicons
              name={wishlisted ? "heart" : "heart-outline"}
              size={18}
              color={wishlisted ? colors.primary : colors.icon}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={justAdded ? `Added ${product.name} to cart` : `Add ${product.name} to cart`}
            accessibilityRole="button"
            accessibilityState={{ disabled: false }}
            onPress={handleQuickAdd}
            className="flex-1 h-9 rounded-lg bg-primary flex-row items-center justify-center gap-1.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Animated.View
              key={justAdded ? "added" : "add"}
              entering={FadeInDown.duration(180)}
              exiting={FadeOutUp.duration(120)}
              className="flex-row items-center justify-center gap-1.5"
            >
              <Ionicons name={justAdded ? "checkmark" : "cart-outline"} size={15} color={colors.foreground} />
              <Text className="text-primary-foreground text-[11px] font-bold">
                {justAdded ? "Added" : "Add"}
              </Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
