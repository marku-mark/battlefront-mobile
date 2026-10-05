import { useCallback, useMemo, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import { useRouter, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { getBanners, getBrands, getCategories, getCatalogPreview, getCatalogSnapshot, invalidateCatalog, loadNextCatalogPage, subscribeCatalog, homeCatalogFromProducts } from "@/lib/api";
import type { Banner, Brand, Category, Product } from "@/lib/data";
import { Header } from "@/components/layout/Header";
import { PromoBanners } from "@/components/sections/PromoBanners";
import { Categories } from "@/components/sections/Categories";
import { FlashDeals } from "@/components/sections/FlashDeals";
import { SulitPicks } from "@/components/sections/SulitPicks";
import { Brands } from "@/components/sections/Brands";
import { Chatbot } from "@/components/support/Chatbot";
import { ProductSearch } from "@/components/search/ProductSearch";
import { useCart } from "@/hooks/useCart";
import { useRecentlyViewedProducts } from "@/hooks/useRecentlyViewed";
import { ProductCard } from "@/components/sections/ProductCard";
import { ProductImage } from "@/components/products/ProductImage";
import { BuilderEntryCard } from "@/components/builder/BuilderEntryCard";
import { LoadingMoreFooter } from "@/components/layout/LoadingMoreFooter";
import { getGridCardWidth, getResponsiveLayout, MAX_CONTENT_WIDTH } from "@/lib/responsive";
import { getProductImageSource } from "@/lib/data";

type HomeRow = { id: string; kind: "products"; products: Product[] } | { id: string; kind: "recent" | "brands" | "builder" | "promo" };

export default function HomeScreen() {
  const router = useRouter();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const returnToSearch = useRef(false);
  useFocusEffect(useCallback(() => {
    if (returnToSearch.current) { returnToSearch.current = false; setIsSearchOpen(true); }
  }, []));
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [catalog, setCatalog] = useState(getCatalogSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metadataError, setMetadataError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { itemCount, items: cartItems, subtotal } = useCart();
  const { products: recentlyViewedProducts, refresh: refreshRecentlyViewed } = useRecentlyViewedProducts();
  const { width, fontScale } = useWindowDimensions();
  const layout = getResponsiveLayout(width, fontScale);
  const cardWidth = getGridCardWidth(width, layout.productColumns);
  const featured = useMemo(() => homeCatalogFromProducts(catalog.rows.slice(0, 12)), [catalog.rows]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const unsubscribe = subscribeCatalog(setCatalog);
    void getCatalogPreview().catch(() => undefined).finally(() => { if (active) setIsRefreshing(false); });
    void refreshRecentlyViewed();
    Promise.all([getBanners(), getCategories(), getBrands()]).then(([nextBanners, nextCategories, nextBrands]) => {
      if (!active) return;
      setBanners(nextBanners); setCategories(nextCategories); setBrands(nextBrands); setMetadataError(false);
    }).catch(() => { if (active) setMetadataError(true); });
    return () => { active = false; unsubscribe(); };
  }, [retryCount, refreshRecentlyViewed]));

  const openProduct = useCallback((product: Product) => {
    setIsSearchOpen(false);
    router.push({ pathname: "/product/[id]", params: { id: product.id } });
  }, [router]);
  const loadMore = useCallback(() => {
    const current = getCatalogSnapshot();
    if (!current.loading && !current.complete && !current.error) void loadNextCatalogPage().catch(() => undefined);
  }, []);
  const retry = () => {
    if (catalog.error && catalog.rows.length) void loadNextCatalogPage().catch(() => undefined);
    setRetryCount((count) => count + 1);
  };
  const rows = useMemo<HomeRow[]>(() => {
    const result: HomeRow[] = [];
    for (let index = 0; index < catalog.rows.length; index += layout.productColumns) {
      result.push({ id: "products-" + catalog.rows[index].id, kind: "products", products: catalog.rows.slice(index, index + layout.productColumns) });
      if (index < 12 && index + layout.productColumns >= Math.min(12, catalog.rows.length)) {
        if (recentlyViewedProducts.length) result.push({ id: "recent", kind: "recent" });
        result.push({ id: "builder", kind: "builder" }, { id: "brands", kind: "brands" }, { id: "promo", kind: "promo" });
      }
    }
    return result;
  }, [catalog.rows, layout.productColumns, recentlyViewedProducts.length]);
  const renderRow = useCallback(({ item }: { item: HomeRow }) => {
    if (item.kind === "recent") return <RecentlyViewedSection products={recentlyViewedProducts} onSelectProduct={openProduct} />;
    if (item.kind === "builder") return <BuilderEntryCard onPress={() => router.push("/builder")} />;
    if (item.kind === "brands") return <Brands brands={brands} onSelect={(brand) => router.push({ pathname: "/categories", params: { brandId: brand.id } })} />;
    if (item.kind === "promo") return <View className="my-5"><PromoBanners banners={banners} onSelect={() => router.push("/categories")} /></View>;
    if (item.kind === "products") return <View className="flex-row px-2.5 pb-3">{item.products.map((product) => <View key={product.id} style={{ paddingHorizontal: 6 }}><ProductCard product={product} width={cardWidth} onPress={openProduct} /></View>)}</View>;
    return null;
  }, [banners, brands, cardWidth, openProduct, recentlyViewedProducts, router]);

  return <View className="flex-1 bg-background">
    <Header cartCount={itemCount} onCartPress={() => router.navigate("/cart")} onNotificationPress={() => router.push("/notifications")} onSearchPress={() => setIsSearchOpen(true)} />
    <FlashList
      data={rows}
      keyExtractor={(item) => item.id}
      getItemType={(item) => item.kind}
      renderItem={renderRow}
      refreshing={isRefreshing}
      onRefresh={() => { if (isRefreshing) return; setIsRefreshing(true); invalidateCatalog(); setRetryCount((count) => count + 1); }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      contentContainerStyle={{ paddingBottom: 88, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      ListHeaderComponent={<View>
        {(catalog.error || metadataError) && <View className="mx-4 mt-4 border border-border bg-card p-4"><Text accessibilityLiveRegion="polite" className="text-danger text-sm">{catalog.error?.message ?? "Some browsing options could not be refreshed."}</Text><Pressable accessibilityRole="button" onPress={retry} className="min-h-12 justify-center"><Text className="text-primary font-semibold">Try again</Text></Pressable></View>}
        <Categories categories={categories} onBrowseAll={() => router.navigate("/categories")} onSelect={(category) => router.push({ pathname: "/categories", params: { categoryId: category.id } })} />
        {cartItems.length > 0 && <ContinueCartBanner itemCount={itemCount} subtotal={subtotal} onPress={() => router.navigate("/cart")} />}
        {featured.flashDeals.length ? <FlashDeals products={featured.flashDeals.slice(0, 6)} onSelectProduct={openProduct} /> : <SulitPicks products={featured.sulitPicks.slice(0, 6)} onSelectProduct={openProduct} />}
        <View className="px-4 mt-6 mb-3"><Text accessibilityRole="header" className="text-foreground text-lg font-bold">Browse products</Text></View>
      </View>}
      ListEmptyComponent={catalog.loading ? <View><LoadingCategories /><LoadingProductRail /></View> : !catalog.error ? <View className="px-6 py-12"><Text className="text-foreground text-base">No products available</Text><Text className="text-muted-foreground mt-2">Pull down to refresh the catalog.</Text></View> : null}
      ListFooterComponent={catalog.loading && catalog.rows.length ? <LoadingMoreFooter /> : catalog.error && catalog.rows.length ? <Pressable accessibilityRole="button" onPress={retry} className="p-4"><Text className="text-primary text-center">Retry loading products</Text></Pressable> : null}
    />
    <Pressable accessibilityRole="button" accessibilityLabel="Open Battlefront Support chat" onPress={() => setIsChatOpen(true)} className="absolute right-4 bottom-5 w-14 h-14 rounded-full bg-primary items-center justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name="chatbubble-ellipses" size={24} color="#f8fafc" />
    </Pressable>
    {isChatOpen && <Chatbot visible onClose={() => setIsChatOpen(false)} />}
    <ProductSearch visible={isSearchOpen} products={catalog.rows} onClose={() => setIsSearchOpen(false)} onSelectProduct={(product) => { returnToSearch.current = true; openProduct(product); }} />
  </View>;
}

function ContinueCartBanner({
  itemCount,
  subtotal,
  onPress,
}: {
  itemCount: number;
  subtotal: number;
  onPress: () => void;
}) {
  return (
    <View className="px-4 mt-6">
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="flex-row items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3"
      >
        <View className="flex-1">
          <Text className="text-foreground text-sm font-bold">Continue your cart</Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5">
            {itemCount} item{itemCount === 1 ? "" : "s"} · ₱{subtotal.toLocaleString("en-PH")}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-primary text-xs font-bold uppercase tracking-[0.12em]">Review</Text>
          <Ionicons name="chevron-forward" size={16} color="#ef1b1b" />
        </View>
      </Pressable>
    </View>
  );
}

function RecentlyViewedSection({
  products,
  onSelectProduct,
}: {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}) {
  return (
    <View className="mt-7">
      <View className="mb-3 px-4 flex-row items-center justify-between">
        <Text className="text-foreground text-base font-bold">Recently viewed</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 6, gap: 10 }}>
        {products.map((product) => (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            onPress={() => onSelectProduct(product)}
            className="w-[150px] overflow-hidden rounded-2xl border border-border bg-card"
          >
            <ProductImage source={getProductImageSource(product.image)} className="w-[150px] h-[120px] bg-secondary" resizeMode="cover" />
            <View className="px-2.5 py-2.5">
              <Text className="text-foreground text-[12px] font-semibold" numberOfLines={2}>
                {product.name}
              </Text>
              <Text className="text-primary text-[12px] font-bold mt-1">
                ₱{product.price.toLocaleString("en-PH")}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function LoadingCategories() {
  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View>
          <View className="h-4 w-32 rounded-full bg-secondary" />
          <View className="mt-1.5 h-2.5 w-24 rounded-full bg-secondary" />
        </View>
        <View className="h-3 w-14 rounded-full bg-secondary" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={index} className="items-center w-[74px]">
            <View className="w-14 h-14 rounded-2xl bg-secondary border border-border" />
            <View className="mt-1.5 h-3 w-14 rounded-full bg-secondary" />
            <View className="mt-1 h-3 w-10 rounded-full bg-secondary" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function LoadingProductRail() {
  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View className="flex-row items-center gap-2">
          <View>
            <View className="h-4 w-24 rounded-full bg-secondary" />
            <View className="mt-1.5 h-2.5 w-28 rounded-full bg-secondary" />
          </View>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} className="w-[140px] rounded-2xl overflow-hidden bg-card border border-border">
            <View className="h-[134px] bg-secondary" />
            <View className="px-2.5 pt-2.5 pb-3">
              <View className="h-3.5 w-5/6 rounded-full bg-secondary" />
              <View className="mt-1.5 h-3 w-2/3 rounded-full bg-secondary" />
              <View className="mt-2 h-4 w-3/5 rounded-full bg-secondary" />
              <View className="mt-1.5 h-3 w-1/2 rounded-full bg-secondary" />
            </View>
            <View className="flex-row items-center gap-2 px-2.5 pb-2.5">
              <View className="w-9 h-9 rounded-lg bg-secondary" />
              <View className="flex-1 h-9 rounded-lg bg-secondary" />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
