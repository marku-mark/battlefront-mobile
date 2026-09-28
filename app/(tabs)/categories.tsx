import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard } from "@/components/sections/ProductCard";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { getBrands, getCategories, getProducts } from "@/lib/api";
import type { Brand, Category, Product } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";
import { LoadingMoreFooter } from "@/components/layout/LoadingMoreFooter";
import { getGridCardWidth, getResponsiveLayout, MAX_CONTENT_WIDTH } from "@/lib/responsive";

const PRODUCTS_PER_PAGE = 24;
const PAGE_LOAD_DELAY_MS = 250;

type PriceFilter = "all" | "under-5k" | "under-15k" | "over-15k";
type SortOrder = "featured" | "price-low" | "price-high";

export default function CategoriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const { isDark } = useTheme();
  const { categoryId, brandId } = useLocalSearchParams<{ categoryId?: string; brandId?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [visibleProductCount, setVisibleProductCount] = useState(PRODUCTS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const loadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(categoryId ? [categoryId] : []);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(brandId ?? null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("featured");
  const [draftBrandId, setDraftBrandId] = useState<string | null>(brandId ?? null);
  const [draftPriceFilter, setDraftPriceFilter] = useState<PriceFilter>("all");
  const [draftSortOrder, setDraftSortOrder] = useState<SortOrder>("featured");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    setSelectedCategoryIds(categoryId ? [categoryId] : []);
    setSelectedBrandId(brandId ?? null);
  }, [brandId, categoryId]);

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const [loadedProducts, loadedCategories, loadedBrands] = await Promise.all([getProducts(), getCategories(), getBrands()]);
      setProducts(loadedProducts);
      setCategories(loadedCategories);
      setBrands(loadedBrands);
    } catch {
      setProducts([]);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery ? categories.filter((category) => category.name.toLowerCase().includes(normalizedQuery)) : categories;
  }, [categories, query]);

  const selectedCategories = useMemo(() => categories.filter((category) => selectedCategoryIds.includes(category.id)), [categories, selectedCategoryIds]);
  const visibleCategories = useMemo(() => {
    if (query.trim() || showAllCategories) return filteredCategories;
    const selected = filteredCategories.filter((category) => selectedCategoryIds.includes(category.id));
    const remaining = filteredCategories.filter((category) => !selectedCategoryIds.includes(category.id));
    return [...selected, ...remaining].slice(0, Math.max(6, selected.length));
  }, [filteredCategories, query, selectedCategoryIds, showAllCategories]);

  const filteredProducts = useMemo(() => {
    const normalizedProductQuery = productQuery.trim().toLowerCase();
    const result = products.filter((product) => {
      const categoryMatch = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(product.categoryId);
      const brandMatch = !selectedBrandId || product.brandId === selectedBrandId;
      const priceMatch = priceFilter === "all" || (priceFilter === "under-5k" && product.price < 5000) || (priceFilter === "under-15k" && product.price < 15000) || (priceFilter === "over-15k" && product.price >= 15000);
      const productMatch = !normalizedProductQuery || `${product.name} ${product.brandId}`.toLowerCase().includes(normalizedProductQuery);
      return categoryMatch && brandMatch && priceMatch && productMatch;
    });

    return [...result].sort((left, right) => {
      if (sortOrder === "price-low") return left.price - right.price;
      if (sortOrder === "price-high") return right.price - left.price;
      return 0;
    });
  }, [priceFilter, productQuery, products, selectedBrandId, selectedCategoryIds, sortOrder]);
  const draftProductCount = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(product.categoryId);
      const brandMatch = !draftBrandId || product.brandId === draftBrandId;
      const priceMatch = draftPriceFilter === "all" || (draftPriceFilter === "under-5k" && product.price < 5000) || (draftPriceFilter === "under-15k" && product.price < 15000) || (draftPriceFilter === "over-15k" && product.price >= 15000);
      const normalizedProductQuery = productQuery.trim().toLowerCase();
      const productMatch = !normalizedProductQuery || `${product.name} ${product.brandId}`.toLowerCase().includes(normalizedProductQuery);
      return categoryMatch && brandMatch && priceMatch && productMatch;
    }).length;
  }, [draftBrandId, draftPriceFilter, productQuery, products, selectedCategoryIds]);
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductCount),
    [filteredProducts, visibleProductCount]
  );

  useEffect(() => {
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
    loadMoreTimerRef.current = null;
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
    setVisibleProductCount(PRODUCTS_PER_PAGE);
  }, [priceFilter, productQuery, selectedBrandId, selectedCategoryIds, sortOrder]);

  useEffect(() => () => {
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
  }, []);

  const cardWidth = getGridCardWidth(width, layout.productColumns);
  const categoryGap = 10;
  const categoryCardWidth = (layout.contentWidth - layout.horizontalPadding * 2 - categoryGap * (layout.productColumns - 1)) / layout.productColumns;
  const hasActiveFilters = selectedCategoryIds.length > 0 || Boolean(selectedBrandId) || priceFilter !== "all" || sortOrder !== "featured";

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
    setQuery("");
  }

  function loadMoreProducts() {
    if (isLoadingMoreRef.current || visibleProductCount >= filteredProducts.length) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    loadMoreTimerRef.current = setTimeout(() => {
      setVisibleProductCount((current) => Math.min(current + PRODUCTS_PER_PAGE, filteredProducts.length));
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
      loadMoreTimerRef.current = null;
    }, PAGE_LOAD_DELAY_MS);
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader title="Categories" subtitle="Find the right parts for your next build." />
      <View className="self-center w-full pt-4" style={{ maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: layout.horizontalPadding }}>
        {selectedCategoryIds.length > 0 && <Text className="text-primary text-xs font-semibold mt-2">{selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? "y" : "ies"} selected</Text>}
        <View className="flex-row items-center gap-2 bg-secondary border border-border rounded-xl px-3 mt-4 h-11">
          <Ionicons name="search-outline" size={18} color={isDark ? "#cbd5e1" : "#68717e"} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search categories" placeholderTextColor="#94a3b8" autoCapitalize="none" returnKeyType="search" className="flex-1 text-foreground text-sm" />
          {query.length > 0 && <Pressable accessibilityLabel="Clear category search" onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={isDark ? "#9ca3af" : "#68717e"} /></Pressable>}
        </View>
      </View>

      <FlashList
        data={isLoading || hasLoadError ? [] : visibleProducts}
        keyExtractor={(item) => item.id}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.4}
        ListFooterComponent={isLoadingMore ? <LoadingMoreFooter /> : null}
        key={`category-products-${layout.productColumns}`}
        numColumns={layout.productColumns}
        masonry
        optimizeItemArrangement={false}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 16, paddingHorizontal: 10, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
        ListHeaderComponentStyle={{ marginHorizontal: -10 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: layout.horizontalPadding }}>
              <Text className="text-muted-foreground text-xs uppercase tracking-[0.14em] mb-3">
                {query.trim() ? `${filteredCategories.length} categories` : "Shop by needs"}
              </Text>
              {visibleCategories.length > 0 ? (
                <View className="flex-row flex-wrap" style={{ gap: categoryGap }}>
                  {visibleCategories.map((category) => {
                    const selected = selectedCategoryIds.includes(category.id);
                    return (
                      <Pressable
                        key={category.id}
                        accessibilityLabel={`Browse ${category.name}`}
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedCategoryIds((current) => selected ? current.filter((id) => id !== category.id) : [...current, category.id])}
                        className={`min-h-[88px] flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 ${selected ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
                        style={({ pressed }) => ({ width: categoryCardWidth, opacity: pressed ? 0.72 : 1 })}
                      >
                        <View className="w-9 h-9 rounded-lg bg-secondary items-center justify-center">
                          <Ionicons name={category.icon as any} size={20} color={isDark ? "#f8fafc" : "#30343b"} />
                        </View>
                        <Text numberOfLines={2} className="flex-1 text-foreground text-xs font-semibold">
                          {category.name}
                        </Text>
                        <Ionicons name={selected ? "checkmark-circle" : "arrow-forward"} size={15} color="#ef1b1b" />
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <EmptyCategories />
              )}
              {!query.trim() && filteredCategories.length > 6 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllCategories }}
                  onPress={() => setShowAllCategories((current) => !current)}
                  className="self-start py-2"
                >
                  <Text className="text-primary text-xs font-semibold">
                    {showAllCategories ? "Show fewer categories" : `Show all ${filteredCategories.length} categories`}
                  </Text>
                </Pressable>
              )}
            </View>
            <View className="mt-4 px-4">
              <View className="flex-row items-end justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-foreground text-base font-bold" numberOfLines={1}>
                    {selectedCategories.length > 0 ? selectedCategories.map((category) => category.name).join(", ") : "All products"}
                  </Text>
                  <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em] mt-1">
                    {filteredProducts.length} products
                  </Text>
                </View>
                <FilterButton label={hasActiveFilters ? "Filters applied" : "Filter and sort"} active={hasActiveFilters} onPress={openFilterSheet} />
              </View>
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
              {(selectedCategories.length > 0 || selectedBrandId || priceFilter !== "all" || sortOrder !== "featured" || productQuery.trim()) && (
                <View className="flex-row flex-wrap items-center gap-2 mt-3">
                  {selectedCategories.map((category) => (
                    <FilterChip
                      key={category.id}
                      label={category.name}
                      onRemove={() => setSelectedCategoryIds((current) => current.filter((id) => id !== category.id))}
                    />
                  ))}
                  {selectedBrandId && (
                    <FilterChip
                      label={brands.find((brand) => brand.id === selectedBrandId)?.name ?? selectedBrandId}
                      onRemove={() => setSelectedBrandId(null)}
                    />
                  )}
                  {priceFilter !== "all" && (
                    <FilterChip
                      label={getPriceFilterLabel(priceFilter)}
                      onRemove={() => setPriceFilter("all")}
                    />
                  )}
                  {sortOrder !== "featured" && (
                    <FilterChip
                      label={sortOrder === "price-low" ? "Price: low to high" : "Price: high to low"}
                      onRemove={() => setSortOrder("featured")}
                    />
                  )}
                  {productQuery.trim().length > 0 && (
                    <FilterChip label={`Search: ${productQuery.trim()}`} onRemove={() => setProductQuery("")} />
                  )}
                  <Pressable accessibilityRole="button" onPress={resetFilters} className="h-8 justify-center px-1">
                    <Text className="text-primary text-xs font-semibold">Clear all</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <CatalogState icon="refresh-outline" title="Loading products" message="Preparing the offline catalog." showSpinner />
          ) : hasLoadError ? (
            <CatalogState icon="cloud-offline-outline" title="Could not load products" message="Check the local catalog and try again." actionLabel="Try again" onAction={loadCatalog} />
          ) : products.length === 0 ? (
            <CatalogState icon="search-outline" title="No products available" message="The local catalog is empty." />
          ) : productQuery.trim() ? (
            <CatalogState icon="search-outline" title="No matching products" message="Try another product name or clear the search." actionLabel="Clear search" onAction={() => setProductQuery("")} />
          ) : selectedCategoryIds.length > 0 && !selectedBrandId && priceFilter === "all" ? (
            <CatalogState icon="search-outline" title="No products in this category" message="Choose another category or browse all products." actionLabel="Browse all products" onAction={() => setSelectedCategoryIds([])} />
          ) : (
            <CatalogState icon="search-outline" title="No products match these filters" message="Remove a filter or reset the selection." actionLabel="Clear all" onAction={resetFilters} />
          )
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 6 }}>
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={(product) => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
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
                <Text className="text-primary-foreground text-sm font-bold">Show {draftProductCount} products</Text>
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

function EmptyCategories() {
  return <View className="items-center py-12 px-4"><Ionicons name="search-outline" size={28} color="#9ca3af" /><Text className="text-foreground text-sm font-semibold mt-3">No categories found</Text><Text className="text-muted-foreground text-xs mt-1">Try a different search term.</Text></View>;
}

function CatalogState({ icon, title, message, actionLabel, onAction, showSpinner = false }: { icon: "refresh-outline" | "cloud-offline-outline" | "search-outline"; title: string; message: string; actionLabel?: string; onAction?: () => void; showSpinner?: boolean }) {
  return <View className="items-center py-12 px-4">{showSpinner ? <ActivityIndicator color="#ef1b1b" /> : <Ionicons name={icon} size={28} color="#9ca3af" />}<Text className="text-foreground text-sm font-semibold mt-3">{title}</Text><Text className="text-muted-foreground text-xs text-center mt-1">{message}</Text>{actionLabel && onAction && <Pressable onPress={onAction} className="bg-primary rounded-lg px-4 py-2.5 mt-4"><Text className="text-primary-foreground text-xs font-semibold">{actionLabel}</Text></Pressable>}</View>;
}
