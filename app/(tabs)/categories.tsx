import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard } from "@/components/sections/ProductCard";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { getBrands, getCategories, getCategoryCatalog } from "@/lib/api";
import { categoryQueryString } from "@/lib/categoryQuery";
import type { Brand, Category, Product } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";
import { LoadingMoreFooter } from "@/components/layout/LoadingMoreFooter";
import { getGridCardWidth, getResponsiveLayout, MAX_CONTENT_WIDTH } from "@/lib/responsive";



type PriceFilter = "all" | "under-5k" | "under-15k" | "over-15k";
type SortOrder = "featured" | "price-low" | "price-high";

export default function CategoriesScreen() {
  const router = useRouter();
  const openProduct = useCallback((product: Product) => router.push({ pathname: "/product/[id]", params: { id: product.id } }), [router]);
  const { width, fontScale } = useWindowDimensions();
  const layout = getResponsiveLayout(width, fontScale);
  const { isDark } = useTheme();
  const { categoryId, brandId } = useLocalSearchParams<{ categoryId?: string; brandId?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const listRef = useRef<FlashListRef<Product>>(null);
  const [productQuery, setProductQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(productQuery), 300); return () => clearTimeout(timer); }, [productQuery]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(categoryId ? [categoryId] : []);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(brandId ?? null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("featured");
  const [draftBrandId, setDraftBrandId] = useState<string | null>(brandId ?? null);
  const [draftPriceFilter, setDraftPriceFilter] = useState<PriceFilter>("all");
  const [draftSortOrder, setDraftSortOrder] = useState<SortOrder>("featured");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [metadataError, setMetadataError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryKey = categoryQueryString({ categoryIds: selectedCategoryIds, brand: selectedBrandId, query: debouncedQuery, price: priceFilter, sort: sortOrder });
  const catalog = useMemo(() => getCategoryCatalog(queryKey), [queryKey]);
  const restoreOffset = useMemo(() => catalog.scrollOffset, [catalog, layout.productColumns]);
  const [observed, setObserved] = useState({ catalog, snapshot: catalog.pager.snapshot() });
  const snapshot = observed.catalog === catalog ? observed.snapshot : catalog.pager.snapshot();
  const products = snapshot.rows;
  const isCatalogLoading = snapshot.loading;
  const hasLoadError = Boolean(snapshot.error);
  const isLoading = !products.length && !snapshot.complete && !snapshot.error;
  const visibleProducts = products;

  useEffect(() => {
    setSelectedCategoryIds(categoryId ? [categoryId] : []);
    setSelectedBrandId(brandId ?? null);
  }, [brandId, categoryId]);

  useFocusEffect(useCallback(() => {
    const unsubscribe = catalog.pager.subscribe((value) => setObserved({ catalog, snapshot: value }));
    void catalog.pager.resume().catch(() => undefined);
    return unsubscribe;
  }, [catalog]));

  useEffect(() => {
    let active = true;
    setMetadataError(false);
    Promise.all([getCategories(), getBrands()]).then(([loadedCategories, loadedBrands]) => {
      if (active) { setCategories(loadedCategories); setBrands(loadedBrands); }
    }).catch(() => { if (active) setMetadataError(true); });
    return () => { active = false; };
  }, [retryCount]);

  function refreshProducts() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    catalog.pager.invalidate();
    void catalog.pager.first().catch(() => undefined).finally(() => setIsRefreshing(false));
  }

  const selectedCategories = useMemo(() => categories.filter((category) => selectedCategoryIds.includes(category.id)), [categories, selectedCategoryIds]);

  const cardWidth = getGridCardWidth(width, layout.productColumns);
  const hasActiveFilters = selectedCategoryIds.length > 0 || Boolean(selectedBrandId) || priceFilter !== "all" || sortOrder !== "featured";
  const activeFilterCount = selectedCategoryIds.length + Number(Boolean(selectedBrandId)) + Number(priceFilter !== "all") + Number(sortOrder !== "featured");

  function openFilterSheet() {
    setDraftBrandId(selectedBrandId);
    setDraftPriceFilter(priceFilter);
    setDraftSortOrder(sortOrder);
    setIsFilterOpen(true);
  }

  function applyFilterDraft() {
    setSelectedBrandId(draftBrandId);
    setPriceFilter(draftPriceFilter);
    setSortOrder(draftSortOrder);
    setIsFilterOpen(false);
  }

  function resetFilterDraft() {
    setDraftBrandId(null);
    setDraftPriceFilter("all");
    setDraftSortOrder("featured");
  }

  function resetFilters() {
    setSelectedCategoryIds([]);
    setSelectedBrandId(null);
    setPriceFilter("all");
    setSortOrder("featured");
    setProductQuery("");
  }

  function loadMoreProducts() {
    const current = catalog.pager.snapshot();
    if (!current.complete && !current.loading && !current.error) void catalog.pager.next().catch(() => undefined);
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader title="Categories" subtitle="Find the right parts for your next build." />
      <FlashList
        ref={listRef}
        onLoad={() => { if (restoreOffset > 0) listRef.current?.scrollToOffset({ offset: restoreOffset, animated: false }); }}
        onScroll={(event) => { catalog.scrollOffset = event.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={100}
        data={isLoading ? [] : visibleProducts}
        refreshing={isRefreshing}
        onRefresh={refreshProducts}
        keyExtractor={(item) => item.id}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.4}
        ListFooterComponent={isCatalogLoading && products.length > 0 ? <LoadingMoreFooter /> : hasLoadError && products.length > 0 ? <Pressable accessibilityRole="button" onPress={() => { void catalog.pager.next().catch(() => undefined); }} className="p-4"><Text className="text-primary text-center">Retry loading products</Text></Pressable> : null}
        key={`category-products-${queryKey}-${layout.productColumns}`}
        numColumns={layout.productColumns}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 16, paddingHorizontal: 10, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
        ListHeaderComponentStyle={{ marginHorizontal: -10 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View className="pb-2">
            {metadataError && <Pressable accessibilityRole="button" onPress={() => setRetryCount((count) => count + 1)} className="mx-4 p-3"><Text className="text-primary">Could not load filter options. Tap to retry.</Text></Pressable>}
            <View className="self-center w-full px-4" style={{ maxWidth: MAX_CONTENT_WIDTH }}>
              <View className="h-10 flex-row items-center gap-2 rounded-lg border border-border bg-secondary px-3">
                <Ionicons name="search-outline" size={16} color={isDark ? "#cbd5e1" : "#68717e"} />
                <TextInput
                  value={productQuery}
                  onChangeText={setProductQuery}
                  placeholder="Search products in this list"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel="Search products in selected categories"
                  className="flex-1 text-foreground text-sm"
                />
                {productQuery.length > 0 && (
                  <Pressable accessibilityLabel="Clear product search" onPress={() => setProductQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={isDark ? "#9ca3af" : "#68717e"} />
                  </Pressable>
                )}
              </View>
            </View>
            {categories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.horizontalPadding, paddingTop: 14 }}>
                {categories.map((category) => (
                  <CategoryChip
                    key={category.id}
                    label={category.name}
                    selected={selectedCategoryIds.includes(category.id)}
                    onPress={() => setSelectedCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])}
                  />
                ))}
              </ScrollView>
            )}
            <View className="self-center w-full px-4 pt-4" style={{ maxWidth: MAX_CONTENT_WIDTH }}>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-foreground text-base font-bold" numberOfLines={1}>
                    {selectedCategories.length > 0 ? selectedCategories.map((category) => category.name).join(", ") : "All products"}
                  </Text>
                </View>
                <FilterButton
                  label={activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter and sort"}
                  active={hasActiveFilters}
                  onPress={openFilterSheet}
                />
              </View>
              {(selectedBrandId || priceFilter !== "all" || sortOrder !== "featured") && (
                <View className="flex-row flex-wrap items-center gap-2 mt-3">
                  {selectedBrandId && (
                    <FilterChip label={brands.find((brand) => brand.id === selectedBrandId)?.name ?? selectedBrandId} onRemove={() => setSelectedBrandId(null)} />
                  )}
                  {priceFilter !== "all" && <FilterChip label={getPriceFilterLabel(priceFilter)} onRemove={() => setPriceFilter("all")} />}
                  {sortOrder !== "featured" && <FilterChip label={sortOrder === "price-low" ? "Price: low to high" : "Price: high to low"} onRemove={() => setSortOrder("featured")} />}
                  <Pressable accessibilityRole="button" onPress={resetFilters} className="h-8 justify-center px-1">
                    <Text className="text-primary text-xs font-semibold">Clear all</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading || isCatalogLoading ? (
            <View accessible accessibilityLabel="Loading products" accessibilityState={{ busy: true }} className="pt-2">
              {Array.from({ length: 2 }, (_, row) => (
                <View key={row} className="flex-row">
                  {Array.from({ length: layout.productColumns }, (_, column) => (
                    <View key={column} style={{ flex: 1, paddingHorizontal: 6, paddingBottom: 12 }}>
                      <View className="rounded-2xl overflow-hidden border border-border bg-card" style={{ width: cardWidth }}>
                        <View className="bg-secondary" style={{ height: cardWidth * 0.96 }} />
                        <View className="px-2.5 pt-2.5 pb-3">
                          <View className="h-3 rounded bg-secondary" />
                          <View className="h-3 w-2/3 mt-2 rounded bg-secondary" />
                          <View className="h-5 w-1/2 mt-3 rounded bg-secondary" />
                          <View className="h-9 mt-3 rounded-xl bg-secondary" />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : hasLoadError ? (
            <CatalogState icon="cloud-offline-outline" title="Could not load products" message="Check your connection and try again." actionLabel="Try again" onAction={() => { void catalog.pager.next().catch(() => undefined); }} />
          ) : !hasActiveFilters && !productQuery.trim() ? (
            <CatalogState icon="search-outline" title="No products available" message="There are no products available in the catalog." />
          ) : productQuery.trim() ? (
            <CatalogState icon="search-outline" title="No matching products" message="Try another product name or clear the search." actionLabel="Clear search" onAction={() => setProductQuery("")} />
          ) : selectedCategoryIds.length > 0 && !selectedBrandId && priceFilter === "all" ? (
            <CatalogState icon="search-outline" title="No products in this category" message="Choose another category or browse all products." actionLabel="Browse all products" onAction={() => setSelectedCategoryIds([])} />
          ) : (
            <CatalogState icon="search-outline" title="No products match these filters" message="Remove a filter or reset the selection." actionLabel="Clear all" onAction={resetFilters} />
          )
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, paddingHorizontal: 6, paddingBottom: 12 }}>
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={openProduct}
            />
          </View>
        )}
      />

      <Modal
        visible={isFilterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFilterOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[88%] w-full self-center rounded-t-3xl border-t border-border bg-background px-4 pt-4 pb-8" style={{ maxWidth: 680 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-lg font-bold">Filter and sort</Text>
              <Pressable accessibilityLabel="Cancel filters" onPress={() => setIsFilterOpen(false)} hitSlop={8} className="w-9 h-9 items-center justify-center">
                <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
              </Pressable>
            </View>
            <ScrollView className="mt-2" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <FilterSection title="Sort by">
                <FilterButton label="Featured" active={draftSortOrder === "featured"} onPress={() => setDraftSortOrder("featured")} />
                <FilterButton label="Price: low" active={draftSortOrder === "price-low"} onPress={() => setDraftSortOrder("price-low")} />
                <FilterButton label="Price: high" active={draftSortOrder === "price-high"} onPress={() => setDraftSortOrder("price-high")} />
              </FilterSection>
              <FilterSection title="Price">
                <FilterButton label="Any price" active={draftPriceFilter === "all"} onPress={() => setDraftPriceFilter("all")} />
                <FilterButton label="Under ₱5k" active={draftPriceFilter === "under-5k"} onPress={() => setDraftPriceFilter("under-5k")} />
                <FilterButton label="Under ₱15k" active={draftPriceFilter === "under-15k"} onPress={() => setDraftPriceFilter("under-15k")} />
                <FilterButton label="₱15k+" active={draftPriceFilter === "over-15k"} onPress={() => setDraftPriceFilter("over-15k")} />
              </FilterSection>
              <FilterSection title="Brand">
                {brands.map((brand) => (
                  <FilterButton
                    key={brand.id}
                    label={brand.name}
                    active={draftBrandId === brand.id}
                    onPress={() => setDraftBrandId((current) => current === brand.id ? null : brand.id)}
                  />
                ))}
              </FilterSection>
            </ScrollView>
            <View className="flex-row gap-3 pt-3">
              <Pressable
                accessibilityRole="button"
                onPress={resetFilterDraft}
                className="h-12 flex-1 items-center justify-center rounded-xl border border-border bg-secondary"
              >
                <Text className="text-foreground text-sm font-semibold">Reset</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={applyFilterDraft}
                className="h-12 flex-[2] items-center justify-center rounded-xl bg-primary"
              >
                <Text className="text-primary-foreground text-sm font-bold">Apply filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} className={`h-9 justify-center rounded-lg border px-3 ${active ? "border-primary bg-primary/10" : "border-border bg-secondary"}`} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><Text className={`text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</Text></Pressable>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label} filter`}
      onPress={onRemove}
      className="h-8 flex-row items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5"
    >
      <Text numberOfLines={1} className="max-w-[180px] text-primary text-[11px] font-semibold">{label}</Text>
      <Ionicons name="close" size={13} color="#ef1b1b" />
    </Pressable>
  );
}

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`h-9 justify-center rounded-full border px-3 ${selected ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}
    >
      <Text className={`text-xs font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}>{label}</Text>
    </Pressable>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.12em] mb-2">{title}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function getPriceFilterLabel(filter: PriceFilter): string {
  if (filter === "under-5k") return "Under ₱5k";
  if (filter === "under-15k") return "Under ₱15k";
  if (filter === "over-15k") return "₱15k+";
  return "Any price";
}

function CatalogState({ icon, title, message, actionLabel, onAction, showSpinner = false }: { icon: "refresh-outline" | "cloud-offline-outline" | "search-outline"; title: string; message: string; actionLabel?: string; onAction?: () => void; showSpinner?: boolean }) {
  return <View className="items-center py-12 px-4">{showSpinner ? <ActivityIndicator color="#ef1b1b" /> : <Ionicons name={icon} size={28} color="#9ca3af" />}<Text className="text-foreground text-sm font-semibold mt-3">{title}</Text><Text className="text-muted-foreground text-xs text-center mt-1">{message}</Text>{actionLabel && onAction && <Pressable onPress={onAction} className="bg-primary rounded-lg px-4 py-2.5 mt-4"><Text className="text-primary-foreground text-xs font-semibold">{actionLabel}</Text></Pressable>}</View>;
}
