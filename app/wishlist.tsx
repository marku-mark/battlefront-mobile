import { ProductImage } from "@/components/products/ProductImage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { getProductImageSource, getProductVariants, type Product } from "@/lib/data";
import { getSelectedProducts, getProductSnapshot } from "@/lib/api";
import { LoadingState } from "@/components/layout/LoadingState";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { getResponsiveLayout } from "@/lib/responsive";

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export default function WishlistScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const { items: wishlistIds, toggleWishlist, isLoading: isWishlistLoading } = useWishlist();
  const { addItem, items: cartItems } = useCart();
  const [removedProduct, setRemovedProduct] = useState<Product | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [hasCatalogError, setHasCatalogError] = useState(false);
  const { isHydrated, session } = useSession();
  const owner = session.mode === "customer" ? session.user.id : "guest";
  const [visibleCount, setVisibleCount] = useState(12);
  const [retryCount, setRetryCount] = useState(0);
  const loadingMore = useRef(false);
  const idsKey = wishlistIds.slice(0, visibleCount).join(",");

  useEffect(() => { setVisibleCount(12); setRemovedProduct(null); }, [owner]);
  useEffect(() => {
    if (!isHydrated || isWishlistLoading) return;
    let active = true;
    const ids = idsKey ? idsKey.split(",") : [];
    const cached = ids.map(getProductSnapshot).filter((product): product is Product => Boolean(product));
    setCatalogProducts(cached); setIsCatalogLoading(true); setHasCatalogError(false);
    getSelectedProducts(ids).then((rows) => { if (active) setCatalogProducts(rows); })
      .catch(() => { if (active) { setCatalogProducts(ids.map(getProductSnapshot).filter((product): product is Product => Boolean(product))); setHasCatalogError(true); } })
      .finally(() => { if (active) { setIsCatalogLoading(false); loadingMore.current = false; } });
    return () => { active = false; };
  }, [idsKey, owner, isHydrated, isWishlistLoading, retryCount]);
  function loadCatalog() { setRetryCount((current) => current + 1); }
  const isLoading = !isHydrated || isWishlistLoading || (isCatalogLoading && catalogProducts.length === 0);
  const products = catalogProducts.filter((product) => wishlistIds.includes(product.id));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back to account"
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#f8fafc" />
        </Pressable>
        <View className="ml-2">
          <Text className="text-foreground text-lg font-bold">Wishlist</Text>
          <Text className="text-muted-foreground text-xs mt-0.5">
            {isLoading ? "Loading saved items" : `${wishlistIds.length} saved item${wishlistIds.length === 1 ? "" : "s"}`}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <LoadingState label="Loading wishlist..." />
      ) : hasCatalogError && catalogProducts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="cloud-offline-outline" size={30} color="#94a3b8" />
          <Text className="mt-3 text-foreground text-sm font-semibold">Could not load saved products</Text>
          <Text className="mt-1 text-center text-muted-foreground text-xs">Check the local catalog and try again.</Text>
          <Pressable onPress={loadCatalog} className="mt-4 rounded-lg bg-primary px-4 py-2.5">
            <Text className="text-primary-foreground text-xs font-semibold">Try again</Text>
          </Pressable>
        </View>
      ) : products.length === 0 && wishlistIds.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center border border-border">
            <Ionicons name="heart-outline" size={34} color="#94a3b8" />
          </View>
          <Text className="text-foreground text-lg font-semibold mt-5">Your wishlist is empty</Text>
          <Text className="text-muted-foreground text-sm text-center mt-2 max-w-[280px]">
            Save products you love so they are ready when you want to buy.
          </Text>
          {removedProduct && (
            <View className="flex-row items-center rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 mt-5">
              <Text className="text-foreground text-xs">{removedProduct.name} removed</Text>
              <Pressable
                accessibilityLabel="Undo remove wishlist item"
                onPress={() => {
                  toggleWishlist(removedProduct.id);
                  setRemovedProduct(null);
                }}
                className="ml-3 px-2 py-1"
              >
                <Text className="text-primary text-xs font-bold">Undo</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={() => router.replace("/")}
            className="bg-primary rounded-xl px-5 py-3 mt-6"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-primary-foreground text-sm font-semibold">Browse products</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList data={products} keyExtractor={(product) => product.id} initialNumToRender={8} maxToRenderPerBatch={6} windowSize={5} onEndReached={() => { if (!isCatalogLoading && !loadingMore.current && visibleCount < wishlistIds.length) { loadingMore.current = true; setVisibleCount((count) => count + 12); } }} onEndReachedThreshold={0.4} ListFooterComponent={<Text className="text-muted-foreground text-center py-3">{isCatalogLoading ? "Loading saved products…" : hasCatalogError ? "Some products could not be updated." : visibleCount < wishlistIds.length ? "Scroll for more saved products" : ""}</Text>} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: layout.horizontalPadding, paddingBottom: 28, width: "100%", maxWidth: 860, alignSelf: "center" }} ListHeaderComponent={removedProduct ? (
            <View className="flex-row items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 mb-3">
              <Text className="flex-1 text-foreground text-xs">{removedProduct.name} removed</Text>
              <Pressable
                accessibilityLabel="Undo remove wishlist item"
                onPress={() => {
                  toggleWishlist(removedProduct.id);
                  setRemovedProduct(null);
                }}
                className="px-2 py-1"
              >
                <Text className="text-primary text-xs font-bold">Undo</Text>
              </Pressable>
            </View>
          ) : null} renderItem={({ item: product }) => (
            <View key={product.id} className="flex-row bg-card border border-border rounded-2xl p-3 mb-3 shadow-soft">
              <Pressable
                accessibilityLabel={`View details for ${product.name}`}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
              >
                <ProductImage source={getProductImageSource(product.image)} className="w-20 h-20 rounded-xl bg-secondary" />
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
                    accessibilityLabel={`Remove ${product.name} from wishlist`}
                    onPress={() => {
                      setRemovedProduct(product);
                      toggleWishlist(product.id);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="heart" size={18} color="#ef1b1b" />
                  </Pressable>
                </View>

                <Text className="text-primary text-sm font-bold mt-2">{formatPrice(product.price)}</Text>

                <View className="flex-row items-center justify-between mt-3">
                  <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
                    Ready to ship
                  </Text>
                  <Pressable
                    accessibilityLabel={`${cartItems.some((item) => item.product.id === product.id) ? "Add another" : "Add"} ${product.name} to cart`}
                    accessibilityHint="Adds one unit to your cart"
                    onPress={() => {
                      addItem(product, 1, getProductVariants(product)[0] ?? null);
                    }}
                    className="bg-primary rounded-lg px-3 py-2"
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  >
                    <Text className="text-primary-foreground text-[11px] font-bold">{cartItems.some((item) => item.product.id === product.id) ? "Add another" : "Add to cart"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )} />
      )}
    </SafeAreaView>
  );
}
