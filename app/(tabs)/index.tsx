import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useRouter, useFocusEffect } from "expo-router";
import { Alert, Image as RNImage, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import {
  getBanners,
  getBrands,
  getCategories,
  getFlashDealEndTime,
  getHomeCatalog,
} from "@/lib/api";
import type { Banner, Brand, Category, Product } from "@/lib/data";
import { Header } from "@/components/layout/Header";
import { PromoBanners } from "@/components/sections/PromoBanners";
import { Categories } from "@/components/sections/Categories";
import { FlashDeals } from "@/components/sections/FlashDeals";
import { TrustBar } from "@/components/sections/TrustBar";
import { SulitPicks } from "@/components/sections/SulitPicks";
import { NewArrivals } from "@/components/sections/NewArrivals";
import { Brands } from "@/components/sections/Brands";
import { Chatbot } from "@/components/support/Chatbot";
import { ProductSearch } from "@/components/search/ProductSearch";
import { useCart } from "@/hooks/useCart";
import { useRecentlyViewedProducts } from "@/hooks/useRecentlyViewed";
import { ProductCard } from "@/components/sections/ProductCard";
import { BuilderEntryCard } from "@/components/builder/BuilderEntryCard";
import { LoadingMoreFooter } from "@/components/layout/LoadingMoreFooter";
import { getGridCardWidth, getResponsiveLayout, MAX_CONTENT_WIDTH } from "@/lib/responsive";
import { getProductImageSource } from "@/lib/data";

const PRODUCTS_PER_PAGE = 24;
const PAGE_LOAD_DELAY_MS = 250;

export default function HomeScreen() {
  const router = useRouter();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [sulitPicks, setSulitPicks] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [visibleProductCount, setVisibleProductCount] = useState(PRODUCTS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const loadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { addItem, itemCount, items: cartItems, subtotal: cartSubtotal } = useCart();
  const { products: recentlyViewedProducts, refresh: refreshRecentlyViewed } = useRecentlyViewedProducts();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);

  const flashDealEndTime = useMemo(() => getFlashDealEndTime(), []);
  const searchableProducts = useMemo(
    () => catalogProducts.length > 0 ? catalogProducts : [...flashDeals, ...sulitPicks, ...newArrivals],
    [catalogProducts, flashDeals, newArrivals, sulitPicks]
  );
  const visibleCatalogProducts = useMemo(
    () => catalogProducts.slice(0, visibleProductCount),
    [catalogProducts, visibleProductCount]
  );
  const recentProductIds = useMemo(
    () => new Set(recentlyViewedProducts.map((product) => product.id)),
    [recentlyViewedProducts]
  );
  const recommendedProducts = useMemo(() => {
    if (!catalogProducts.length) return [];

    return [...catalogProducts]
      .filter((product) => !recentProductIds.has(product.id))
      .sort((left, right) => {
        const leftScore = (left.rating ?? 4.8) * (left.reviewCount ?? 1) + (left.stockQuantity ?? 0) * 0.1;
        const rightScore = (right.rating ?? 4.8) * (right.reviewCount ?? 1) + (right.stockQuantity ?? 0) * 0.1;
        return rightScore - leftScore;
      })
      .slice(0, 6);
  }, [catalogProducts, recentProductIds]);
  const setupBundles = useMemo(() => {
    if (!catalogProducts.length) return [];

    const categoryLookup = new Map<string, Product[]>();
    catalogProducts.forEach((product) => {
      const existing = categoryLookup.get(product.categoryId) ?? [];
      categoryLookup.set(product.categoryId, [...existing, product]);
    });

    const pickProducts = (...categoryIds: string[]) =>
      categoryIds
        .map((categoryId) => categoryLookup.get(categoryId)?.[0])
        .filter((product): product is Product => Boolean(product))
        .slice(0, 3);

    const bundles = [
      {
        title: "Gaming setup",
        subtitle: "Pair the essentials for smooth play",
        products: pickProducts(
          "category-graphics-card",
          "category-processor",
          "category-monitor",
          "category-ram"
        ),
      },
      {
        title: "Workstation",
        subtitle: "Built for focused productivity",
        products: pickProducts(
          "category-laptops-desktops",
          "category-monitor",
          "category-peripherals",
          "category-power-accessories"
        ),
      },
      {
        title: "Upgrade bundle",
        subtitle: "Fast performance additions",
        products: pickProducts(
          "category-storage",
          "category-cooling-components",
          "category-power-supply",
          "category-motherboard"
        ),
      },
    ].filter((bundle) => bundle.products.length >= 2);

    return bundles;
  }, [catalogProducts]);

  function loadMoreProducts() {
    if (isLoadingMoreRef.current || visibleProductCount >= catalogProducts.length) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    loadMoreTimerRef.current = setTimeout(() => {
      setVisibleProductCount((current) => Math.min(current + PRODUCTS_PER_PAGE, catalogProducts.length));
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
      loadMoreTimerRef.current = null;
    }, PAGE_LOAD_DELAY_MS);
  }

  useEffect(() => () => {
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshRecentlyViewed();
    }, [refreshRecentlyViewed])
  );

  function handleProductSelect(product: Product) {
    setIsSearchOpen(false);
    router.push({ pathname: "/product/[id]", params: { id: product.id } });
  }

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setHasLoadError(false);

    Promise.all([getBanners(), getCategories(), getHomeCatalog(), getBrands()])
      .then(([loadedBanners, loadedCategories, homeCatalog, loadedBrands]) => {
        if (!isActive) return;
        setBanners(loadedBanners);
        setCategories(loadedCategories);
        setFlashDeals(homeCatalog.flashDeals);
        setSulitPicks(homeCatalog.sulitPicks);
        setNewArrivals(homeCatalog.newArrivals);
        setCatalogProducts(homeCatalog.catalogProducts);
        setBrands(loadedBrands);
      })
      .catch(() => {
        if (isActive) setHasLoadError(true);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [retryCount]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <Header
          cartCount={itemCount}
          onCartPress={() => router.navigate("/cart")}
          onNotificationPress={() =>
            Alert.alert("Notifications", "Your deals and order updates will appear here.")
          }
          onSearchPress={() => setIsSearchOpen(true)}
          searchDisabled
        />
        <ScrollView showsVerticalScrollIndicator={false} removeClippedSubviews contentContainerStyle={{ paddingBottom: 112 }}>
          <LoadingHero width={width} />
          <LoadingCategories />
          <LoadingProductRail showCountdown />
          <LoadingTrustBar />
          <LoadingProductRail />
        </ScrollView>
      </View>
    );
  }

  if (hasLoadError) {
    return (
      <View className="flex-1 bg-background">
        <Header
          cartCount={itemCount}
          onCartPress={() => router.navigate("/cart")}
          onNotificationPress={() => router.push("/notifications")}
          onSearchPress={() => setIsSearchOpen(true)}
          searchDisabled
        />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="cloud-offline-outline" size={32} color="#9ca3af" />
          <Text className="mt-3 text-foreground text-base font-semibold">Could not load the catalog</Text>
          <Text className="mt-1 text-center text-muted-foreground text-sm">Check your local catalog and try again.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryCount((count) => count + 1)}
            className="mt-5 rounded-xl bg-primary px-5 py-3"
          >
            <Text className="text-primary-foreground text-sm font-semibold">Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Header
        cartCount={itemCount}
        onCartPress={() => router.navigate("/cart")}
        onNotificationPress={() => router.push("/notifications")}
        onSearchPress={() => setIsSearchOpen(true)}
      />
      <FlashList
        data={visibleCatalogProducts}
        key={`home-products-${layout.productColumns}`}
        numColumns={layout.productColumns}
        keyExtractor={(item) => item.id}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.4}
        ListFooterComponent={isLoadingMore ? <LoadingMoreFooter /> : null}
        contentContainerStyle={{ paddingBottom: 28, paddingTop: 16, paddingHorizontal: 10, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
        ListHeaderComponentStyle={{ marginHorizontal: -10 }}
        ListHeaderComponent={
          <View>
            <PromoBanners banners={banners} onSelect={() => router.push("/categories")} />
        <BuilderEntryCard onPress={() => router.push("/builder")} />
        {cartItems.length > 0 && (
          <ContinueCartBanner
            itemCount={itemCount}
            subtotal={cartSubtotal}
            onPress={() => router.navigate("/cart")}
          />
        )}
        {recentlyViewedProducts.length > 0 && (
          <RecentlyViewedSection
            products={recentlyViewedProducts}
            onSelectProduct={handleProductSelect}
          />
        )}
        {recommendedProducts.length > 0 && (
          <RecommendedProductsSection
            products={recommendedProducts}
            onSelectProduct={handleProductSelect}
          />
        )}
        {setupBundles.length > 0 && (
          <SetupBundleSection
            bundles={setupBundles}
            onSelectProduct={handleProductSelect}
          />
        )}
        <Categories
          categories={categories}
          onBrowseAll={() => router.push("/categories")}
          onSelect={(category) =>
            router.push({
              pathname: "/categories",
              params: { categoryId: category.id },
            })
          }
        />
        <FlashDeals
          products={flashDeals}
          endTime={flashDealEndTime}
          onSelectProduct={handleProductSelect}
        />
        <TrustBar />
        <SulitPicks products={sulitPicks} onSelectProduct={handleProductSelect} />
        <NewArrivals products={newArrivals} onSelectProduct={handleProductSelect} />
        <Brands brands={brands} onSelect={(brand) => router.push({ pathname: "/categories", params: { brandId: brand.id } })} />
        <View className="px-4 mt-7 mb-3">
          <Text className="text-foreground text-base font-bold">All products</Text>
          <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em] mt-1">Browse the complete catalog</Text>
        </View>
          </View>
        }
        ListEmptyComponent={!isLoading ? <View className="items-center px-6 py-12"><Text className="text-foreground text-sm font-semibold">No products available</Text><Text className="text-muted-foreground text-xs mt-1">Try refreshing the catalog.</Text></View> : null}
        renderItem={({ item }) => (
          <View style={{ flex: 1, paddingHorizontal: 6, paddingBottom: 12 }}>
            <ProductCard
              product={item}
              width={getGridCardWidth(width, layout.productColumns)}
              onPress={handleProductSelect}
            />
          </View>
        )}
      />
      <Pressable
        accessibilityLabel="Open Battlefront Support chat"
        onPress={() => setIsChatOpen(true)}
        className="absolute right-4 bottom-5 w-14 h-14 rounded-full bg-primary items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#f8fafc" />
      </Pressable>
      <Chatbot visible={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <ProductSearch
        visible={isSearchOpen}
        products={searchableProducts}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={handleProductSelect}
      />
    </View>
  );
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
        <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em]">Your history</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 6, gap: 10 }}>
        {products.map((product) => (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            onPress={() => onSelectProduct(product)}
            className="w-[150px] overflow-hidden rounded-2xl border border-border bg-card"
          >
            <RNImage source={getProductImageSource(product.image)} className="w-[150px] h-[120px] bg-secondary" resizeMode="cover" />
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

function RecommendedProductsSection({
  products,
  onSelectProduct,
}: {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}) {
  return (
    <View className="mt-7">
      <View className="mb-3 px-4 flex-row items-center justify-between">
        <Text className="text-foreground text-base font-bold">Recommended for you</Text>
        <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em]">Top picks</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 6, gap: 10 }}>
        {products.map((product) => (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            onPress={() => onSelectProduct(product)}
            className="w-[150px] overflow-hidden rounded-2xl border border-border bg-card"
          >
            <RNImage source={getProductImageSource(product.image)} className="w-[150px] h-[120px] bg-secondary" resizeMode="cover" />
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

function SetupBundleSection({
  bundles,
  onSelectProduct,
}: {
  bundles: Array<{
    title: string;
    subtitle: string;
    products: Product[];
  }>;
  onSelectProduct: (product: Product) => void;
}) {
  return (
    <View className="mt-7">
      <View className="mb-3 px-4 flex-row items-center justify-between">
        <Text className="text-foreground text-base font-bold">Complete your setup</Text>
        <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em]">Bundle picks</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 6, gap: 10 }}>
        {bundles.map((bundle) => (
          <View key={bundle.title} className="w-[210px] rounded-2xl border border-border bg-card p-3">
            <Text className="text-foreground text-sm font-bold">{bundle.title}</Text>
            <Text className="text-muted-foreground text-[10px] mt-0.5">{bundle.subtitle}</Text>
            <View className="mt-3 gap-2">
              {bundle.products.map((product) => (
                <Pressable
                  key={product.id}
                  accessibilityRole="button"
                  onPress={() => onSelectProduct(product)}
                  className="flex-row items-center gap-2 rounded-xl bg-secondary px-2 py-1.5"
                >
                  <RNImage source={getProductImageSource(product.image)} className="w-10 h-10 rounded-lg bg-background" resizeMode="cover" />
                  <View className="flex-1">
                    <Text className="text-foreground text-[11px] font-semibold" numberOfLines={1}>{product.name}</Text>
                    <Text className="text-primary text-[10px] font-bold mt-0.5">₱{product.price.toLocaleString("en-PH")}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function LoadingHero({ width }: { width: number }) {
  return (
    <View className="mt-4">
      <View style={{ width: width - 32, height: 172 }} className="mx-4 rounded-xl overflow-hidden bg-card border border-border">
        <View className="absolute bottom-0 left-0 right-0 px-4 py-3.5">
          <View className="h-4 w-40 rounded-full bg-secondary" />
          <View className="mt-2 h-3 w-56 rounded-full bg-secondary" />
        </View>
      </View>
      <View className="flex-row justify-center gap-2 mt-2.5">
        <View className="h-1.5 w-4 rounded-full bg-secondary" />
        <View className="h-1.5 w-1.5 rounded-full bg-secondary" />
        <View className="h-1.5 w-1.5 rounded-full bg-secondary" />
      </View>
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

function LoadingProductRail({ showCountdown = false }: { showCountdown?: boolean }) {
  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View className="flex-row items-center gap-2">
          {showCountdown && <View className="w-7 h-7 rounded-full bg-secondary" />}
          <View>
            <View className="h-4 w-24 rounded-full bg-secondary" />
            <View className="mt-1.5 h-2.5 w-28 rounded-full bg-secondary" />
          </View>
        </View>
        {showCountdown && (
          <View className="flex-row gap-1.5">
            <View className="h-5 w-6 rounded-md bg-secondary" />
            <View className="h-5 w-6 rounded-md bg-secondary" />
            <View className="h-5 w-6 rounded-md bg-secondary" />
          </View>
        )}
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

function LoadingTrustBar() {
  return (
    <View className="mx-4 mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <View className="flex-row px-3 py-3.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} className={`flex-1 flex-row items-center justify-center gap-1.5 ${index > 0 ? "border-l border-border" : ""}`}>
            <View className="w-4 h-4 rounded-full bg-secondary" />
            <View className="h-2.5 w-12 rounded-full bg-secondary" />
          </View>
        ))}
      </View>
    </View>
  );
}
