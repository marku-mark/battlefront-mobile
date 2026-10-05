import Ionicons from "@expo/vector-icons/Ionicons";
import { ProductImage } from "@/components/products/ProductImage";
import { useRecyclingState } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Pressable, Text, View } from "react-native";
import { memo, useEffect, useRef } from "react";
import { getProductImageSource, getProductVariants, type Product } from "@/lib/data";
import { useCartActions } from "@/hooks/useCart";
import { useIsWishlisted, useWishlistActions } from "@/hooks/useWishlist";
import { prefetchProductById } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";

type ProductCardProps = {
  product: Product;
  width?: number;
  stretch?: boolean;
  onPress?: (product: Product) => void;
};

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

function ProductCardView({ product, width = 150, stretch = false, onPress }: ProductCardProps) {
  const { addItem } = useCartActions();
  const toggleWishlist = useWishlistActions();
  const { colors, reducedMotion } = useTheme();
  const adding = useRef<string | null>(null);
  const currentId = useRef<string | null>(product.id);
  currentId.current = product.id;
  const [isAdding, setIsAdding] = useRecyclingState(false, [product.id]);
  const [justAdded, setJustAdded] = useRecyclingState(false, [product.id]);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlisted = useIsWishlisted(product.id);

  useEffect(() => {
    currentId.current = product.id;
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      currentId.current = null;
    };
  }, [product.id]);

  async function handleQuickAdd() {
    const id = product.id;
    if (adding.current === id) return;
    adding.current = id;
    setIsAdding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const succeeded = await addItem(product, 1, variants[0] ?? null);
      if (!succeeded || currentId.current !== id) return;
      setJustAdded(true);
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => {
        if (currentId.current === id) setJustAdded(false);
        feedbackTimeout.current = null;
      }, 1400);
    } finally {
      if (adding.current === id) adding.current = null;
      if (currentId.current === id) setIsAdding(false);
    }
  }
  const hasDiscount =
    product.originalPrice !== undefined && product.originalPrice > product.price;
  const rating = product.rating ?? 0;
  const reviewCount = product.reviewCount ?? 0;
  const hasRating = rating > 0 && reviewCount > 0;
  const stockQuantity = ["out_of_stock", "unavailable"].includes(product.availability ?? "") ? 0 : (product.stockQuantity ?? Number.MAX_SAFE_INTEGER);
  const variants = getProductVariants(product);
  const discountPct = hasDiscount
    ? Math.round(
        ((product.originalPrice! - product.price) / product.originalPrice!) * 100
      )
    : 0;
  const isHotPick = hasDiscount || (product.sold !== undefined && product.sold > 120);

  return (
    <View style={{ width, flex: stretch ? 1 : undefined }} className={stretch ? "self-stretch" : "self-start"}>
      <View style={{ flex: stretch ? 1 : undefined }} className="rounded-2xl overflow-hidden bg-card border border-border shadow-soft">
        <Pressable
          accessibilityLabel={`View details for ${product.name}`}
          accessibilityRole="button"
          accessibilityHint="Opens product details"
          onPressIn={() => prefetchProductById(product.id)}
          onPress={() => onPress?.(product)}
          style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1, flex: stretch ? 1 : undefined })}
        >
          <View className="relative">
            <ProductImage
              source={getProductImageSource(product.image)}
              accessibilityLabel={`${product.name} product image`}
              accessible
              style={{ width: "100%", height: width * 0.96 }}
              resizeMode="contain"
            />

            {hasDiscount && (
              <View className="absolute top-2 left-2 bg-ring rounded-full px-2 py-1">
                <Text className="text-primary-foreground text-xs font-bold uppercase tracking-[0.08em]">
                  -{discountPct}%
                </Text>
              </View>
            )}

            {!hasDiscount && isHotPick && (
              <View className="absolute top-2 left-2 bg-primary/90 rounded-full px-2 py-1">
                <Text className="text-primary-foreground text-xs font-bold uppercase tracking-[0.08em]">
                  Hot
                </Text>
              </View>
            )}
          </View>

          <View className="px-2.5 pt-2.5 pb-3">
            <Text numberOfLines={2} className="text-foreground text-[13px] font-semibold leading-4">
              {product.name}
            </Text>

            <View className="flex-row flex-wrap items-end gap-1.5 mt-2">
              <Text className="text-primary font-bold text-[15px]">
                {formatPrice(product.price)}
              </Text>
              {hasDiscount && (
                <Text className="text-muted-foreground text-xs line-through mb-[1px]">
                  {formatPrice(product.originalPrice!)}
                </Text>
              )}
            </View>

            <View className="flex-row flex-wrap items-center justify-between mt-1.5 gap-2">
              <View className="flex-row items-center gap-1">
                {hasRating ? (
                  <>
                    <Ionicons name="star" size={12} color="#f59e0b" />
                    <Text className="text-foreground text-xs font-semibold">{rating.toFixed(1)}</Text>
                    <Text className="text-muted-foreground text-xs">({reviewCount})</Text>
                  </>
                ) : (
                  <Text className="text-muted-foreground text-xs">No reviews</Text>
                )}
              </View>
              <View className="flex-row items-center gap-1">
                <View className={`h-1.5 w-1.5 rounded-full ${stockQuantity > 0 ? "bg-success" : "bg-danger"}`} />
                <Text className={`text-xs uppercase tracking-[0.08em] ${stockQuantity > 0 ? "text-muted-foreground" : "text-danger"}`}>
                  {stockQuantity > 0 ? (product.availability === "low_stock" ? "Low stock" : "In stock") : "Out of stock"}
                </Text>
              </View>
            </View>
            {variants.length > 0 && (
              <Text className="text-muted-foreground text-xs mt-1.5" numberOfLines={1}>
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
            className="w-12 h-12 rounded-lg border border-border items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <Ionicons
              name={wishlisted ? "heart" : "heart-outline"}
              size={18}
              color={wishlisted ? colors.primary : colors.icon}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={`${justAdded ? "Add another" : "Add"} ${product.name} to cart`}
            accessibilityHint="Adds one unit to your cart"
            accessibilityRole="button"
            accessibilityState={{ disabled: stockQuantity <= 0 || isAdding, busy: isAdding }}
            disabled={stockQuantity <= 0 || isAdding}
            onPress={handleQuickAdd}
            className="flex-1 min-h-12 py-2 rounded-lg bg-primary flex-row items-center justify-center gap-1.5"
            style={({ pressed }) => ({ opacity: stockQuantity <= 0 ? 0.45 : pressed ? 0.8 : 1 })}
          >
            <Animated.View
              key={justAdded ? "added" : "add"}
              entering={reducedMotion ? undefined : FadeInDown.duration(180)}
              exiting={reducedMotion ? undefined : FadeOutUp.duration(120)}
              className="flex-row items-center justify-center gap-1.5"
            >
              {width >= 165 && !isAdding && <Ionicons name={justAdded ? "checkmark" : "cart-outline"} size={15} color="#f8fafc" />}
              <Text className="text-primary-foreground text-xs font-bold text-center flex-shrink">
                {isAdding ? "Adding…" : justAdded ? "Added" : "Add"}
              </Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export const ProductCard = memo(ProductCardView);
