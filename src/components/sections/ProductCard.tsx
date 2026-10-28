import Ionicons from "@expo/vector-icons/Ionicons";
import { ProductImage } from "@/components/products/ProductImage";
import { useRecyclingState } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Pressable, Text, View } from "react-native";
import { memo, useEffect, useRef } from "react";
import { getProductImageSource, getProductVariants, type Product } from "@/lib/data";
import { getProductStock } from "@/lib/productCatalog";
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
  const [quantity, setQuantity] = useRecyclingState(1, [product.id]);
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
    if (getProductVariants(product).length) { onPress?.(product); return; }
    const id = product.id;
    if (adding.current === id || selectedQuantity === 0) return;
    adding.current = id;
    setIsAdding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const succeeded = await addItem(product, selectedQuantity, variants[0] ?? null);
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
  const stock = getProductStock(product);
  const selectedQuantity = stock.maxQuantity > 0 ? 1 : 0;
  const variants = getProductVariants(product);
  const discountPct = hasDiscount
    ? Math.round(
        ((product.originalPrice! - product.price) / product.originalPrice!) * 100
      )
    : 0;
  const isHotPick = hasDiscount || (product.sold !== undefined && product.sold > 120);

  return (
    <View style={{ width, flex: stretch ? 1 : undefined }} className={stretch ? "self-stretch" : "self-start"}>
      <View style={{ flex: stretch ? 1 : undefined }} className="rounded-lg overflow-hidden bg-card border border-border ">
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
              className="bg-secondary"
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
            <Text numberOfLines={2} className="text-foreground text-sm font-semibold leading-5">
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

            <View className="mt-1.5 flex-row items-center gap-1">
              <View className="flex-row items-center gap-1">
                {hasRating ? (
                  <>
                    <Ionicons name="star" size={12} color={colors.rating} />
                    <Text className="text-foreground text-xs font-semibold">{rating.toFixed(1)}</Text>
                    <Text className="text-muted-foreground text-xs">({reviewCount})</Text>
                  </>
                ) : (
                  <Text className="text-muted-foreground text-xs">No reviews</Text>
                )}
              </View>
            </View>
            <View className="mt-2 flex-row items-center gap-1">
              <View className={`h-1.5 w-1.5 rounded-full ${stock.maxQuantity > 0 ? "bg-success" : "bg-danger"}`} />
              <Text className={`text-xs ${stock.maxQuantity > 0 ? "text-muted-foreground" : "text-danger"}`}>
                {stock.statusLabel}
              </Text>
            </View>
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
            accessibilityLabel={variants.length ? `Choose options for ${product.name}` : `${justAdded ? "Add another" : "Add"} ${selectedQuantity} ${product.name} to cart`}
            accessibilityHint={variants.length ? "Opens product details to choose options" : `Adds ${selectedQuantity} ${selectedQuantity === 1 ? "unit" : "units"} to your cart`}
            accessibilityRole="button"
            accessibilityState={{ disabled: stock.maxQuantity <= 0 || isAdding, busy: isAdding }}
            disabled={stock.maxQuantity <= 0 || isAdding}
            onPress={handleQuickAdd}
            className="flex-1 min-h-12 py-2 rounded-lg bg-primary flex-row items-center justify-center gap-1.5"
            style={({ pressed }) => ({ opacity: stock.maxQuantity <= 0 ? 0.45 : pressed ? 0.8 : 1 })}
          >
            <Animated.View
              key={justAdded ? "added" : "add"}
              entering={reducedMotion ? undefined : FadeInDown.duration(180)}
              exiting={reducedMotion ? undefined : FadeOutUp.duration(120)}
              className="flex-row items-center justify-center gap-1.5"
            >
              {width >= 165 && !isAdding && <Ionicons name={justAdded ? "checkmark" : "cart-outline"} size={15} color={colors.primaryForeground} />}
              <Text className="text-primary-foreground text-xs font-bold text-center flex-shrink">
                {isAdding ? "Adding…" : justAdded ? "Added" : variants.length ? "Options" : "Add"}
              </Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export const ProductCard = memo(ProductCardView);
