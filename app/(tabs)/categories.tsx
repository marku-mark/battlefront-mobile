import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard } from "@/components/sections/ProductCard";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { getBrands, getCategories, getProducts } from "@/lib/api";
import type { Brand, Category, Product } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";

type PriceFilter = "all" | "under-5k" | "under-15k" | "over-15k";
type SortOrder = "featured" | "price-low" | "price-high";

export default function CategoriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();
  const { categoryId, brandId } = useLocalSearchParams<{ categoryId?: string; brandId?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(categoryId ? [categoryId] : []);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(brandId ?? null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("featured");
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

  const filteredProducts = useMemo(() => {
    const result = products.filter((product) => {
      const categoryMatch = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(product.categoryId);
      const brandMatch = !selectedBrandId || product.brandId === selectedBrandId;
      const priceMatch = priceFilter === "all" || (priceFilter === "under-5k" && product.price < 5000) || (priceFilter === "under-15k" && product.price < 15000) || (priceFilter === "over-15k" && product.price >= 15000);
      return categoryMatch && brandMatch && priceMatch;
    });

    return [...result].sort((left, right) => {
      if (sortOrder === "price-low") return left.price - right.price;
      if (sortOrder === "price-high") return right.price - left.price;
      return 0;
    });
  }, [priceFilter, products, selectedBrandId, selectedCategoryIds, sortOrder]);

  const cardWidth = Math.max(136, (width - 44) / 2);
  const hasActiveFilters = Boolean(selectedBrandId) || priceFilter !== "all" || sortOrder !== "featured";

  function resetFilters() {
    setSelectedCategoryIds([]);
    setSelectedBrandId(null);
    setPriceFilter("all");
    setSortOrder("featured");
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader title="Categories" subtitle="Find the right parts for your next build." />
      <View className="px-4 pt-4">
        {selectedCategoryIds.length > 0 && <Text className="text-primary text-xs font-semibold mt-2">{selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? "y" : "ies"} selected</Text>}
        <View className="flex-row items-center gap-2 bg-secondary border border-border rounded-xl px-3 mt-4 h-11">
          <Ionicons name="search-outline" size={18} color={isDark ? "#cbd5e1" : "#68717e"} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search categories" placeholderTextColor="#94a3b8" autoCapitalize="none" returnKeyType="search" className="flex-1 text-foreground text-sm" />
          {query.length > 0 && <Pressable accessibilityLabel="Clear category search" onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={isDark ? "#9ca3af" : "#68717e"} /></Pressable>}
        </View>
      </View>

      <FlatList
        data={isLoading || hasLoadError ? [] : filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
            <Text className="text-muted-foreground text-xs uppercase tracking-[0.14em] px-4 mb-3">{query.trim() ? `${filteredCategories.length} results` : "Shop by needs"}</Text>
            {filteredCategories.length > 0 ? <View className="flex-row flex-wrap gap-3 px-4">{filteredCategories.map((category) => {
              const selected = selectedCategoryIds.includes(category.id);
              return <Pressable key={category.id} accessibilityLabel={`Browse ${category.name}`} accessibilityState={{ selected }} onPress={() => setSelectedCategoryIds((current) => selected ? current.filter((id) => id !== category.id) : [...current, category.id])} className={`w-[48%] min-h-[128px] rounded-2xl border p-4 justify-between ${selected ? "bg-primary/10 border-primary" : "bg-card border-border"}`} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}><View className="w-11 h-11 rounded-xl bg-secondary items-center justify-center"><Ionicons name={category.icon as any} size={24} color={isDark ? "#f8fafc" : "#30343b"} /></View><View className="flex-row items-center justify-between mt-4"><Text className="text-foreground text-sm font-semibold flex-1">{category.name}</Text><Ionicons name={selected ? "checkmark-circle" : "arrow-forward"} size={16} color="#ef1b1b" /></View></Pressable>;
            })}</View> : <EmptyCategories />}
            <View className="mt-6 px-4">
              <View className="flex-row items-end justify-between mb-3"><View className="flex-1"><Text className="text-foreground text-base font-bold" numberOfLines={1}>{selectedCategories.length > 0 ? selectedCategories.map((category) => category.name).join(", ") : "All products"}</Text><Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em] mt-1">{filteredProducts.length} products</Text></View>{selectedCategoryIds.length > 0 && <Pressable accessibilityLabel="Clear selected categories" onPress={() => setSelectedCategoryIds([])} hitSlop={8}><Text className="text-primary text-[11px] font-semibold uppercase tracking-[0.12em]">Clear</Text></Pressable>}</View>
              <View className="flex-row items-center gap-2"><FilterButton label="Filter and sort" active={hasActiveFilters} onPress={() => setIsFilterOpen(true)} />{hasActiveFilters && <Pressable accessibilityLabel="Reset product filters" onPress={resetFilters} className="h-9 justify-center px-2"><Text className="text-primary text-[11px] font-semibold uppercase tracking-[0.1em]">Reset</Text></Pressable>}</View>
            </View>
          </View>
        }
        ListEmptyComponent={isLoading ? <CatalogState icon="refresh-outline" title="Loading products" message="Preparing the offline catalog." showSpinner /> : hasLoadError ? <CatalogState icon="cloud-offline-outline" title="Could not load products" message="Check the local catalog and try again." actionLabel="Try again" onAction={loadCatalog} /> : <CatalogState icon="search-outline" title="No products match these filters" message="Clear a filter or choose another category." actionLabel="Clear filters" onAction={resetFilters} />}
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} onPress={(product) => router.push({ pathname: "/product/[id]", params: { id: product.id } })} />}
      />

      <Modal visible={isFilterOpen} animationType="slide" transparent onRequestClose={() => setIsFilterOpen(false)}>
        <View className="flex-1 justify-end bg-black/50"><View className="bg-background rounded-t-3xl border-t border-border px-4 pt-4 pb-8"><View className="flex-row items-center justify-between"><Text className="text-foreground text-lg font-bold">Filter and sort</Text><Pressable accessibilityLabel="Close filters" onPress={() => setIsFilterOpen(false)} hitSlop={8} className="w-9 h-9 items-center justify-center"><Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} /></Pressable></View><Text className="text-muted-foreground text-xs uppercase tracking-[0.12em] mt-5 mb-2">Sort by</Text><View className="flex-row flex-wrap gap-2"><FilterButton label="Featured" active={sortOrder === "featured"} onPress={() => setSortOrder("featured")} /><FilterButton label="Price: low" active={sortOrder === "price-low"} onPress={() => setSortOrder("price-low")} /><FilterButton label="Price: high" active={sortOrder === "price-high"} onPress={() => setSortOrder("price-high")} /></View><Text className="text-muted-foreground text-xs uppercase tracking-[0.12em] mt-5 mb-2">Price</Text><View className="flex-row flex-wrap gap-2"><FilterButton label="Any price" active={priceFilter === "all"} onPress={() => setPriceFilter("all")} /><FilterButton label="Under ₱5k" active={priceFilter === "under-5k"} onPress={() => setPriceFilter("under-5k")} /><FilterButton label="Under ₱15k" active={priceFilter === "under-15k"} onPress={() => setPriceFilter("under-15k")} /><FilterButton label="₱15k+" active={priceFilter === "over-15k"} onPress={() => setPriceFilter("over-15k")} /></View><Text className="text-muted-foreground text-xs uppercase tracking-[0.12em] mt-5 mb-2">Brand</Text><View className="flex-row flex-wrap gap-2">{brands.map((brand) => <FilterButton key={brand.id} label={brand.name} active={selectedBrandId === brand.id} onPress={() => setSelectedBrandId((current) => current === brand.id ? null : brand.id)} />)}</View><Pressable onPress={() => setIsFilterOpen(false)} className="bg-primary rounded-xl items-center py-3.5 mt-6"><Text className="text-primary-foreground text-sm font-bold">Show {filteredProducts.length} products</Text></Pressable></View></View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} className={`h-9 justify-center rounded-lg border px-3 ${active ? "border-primary bg-primary/10" : "border-border bg-secondary"}`} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><Text className={`text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</Text></Pressable>;
}

function EmptyCategories() {
  return <View className="items-center py-12 px-4"><Ionicons name="search-outline" size={28} color="#9ca3af" /><Text className="text-foreground text-sm font-semibold mt-3">No categories found</Text><Text className="text-muted-foreground text-xs mt-1">Try a different search term.</Text></View>;
}

function CatalogState({ icon, title, message, actionLabel, onAction, showSpinner = false }: { icon: "refresh-outline" | "cloud-offline-outline" | "search-outline"; title: string; message: string; actionLabel?: string; onAction?: () => void; showSpinner?: boolean }) {
  return <View className="items-center py-12 px-4">{showSpinner ? <ActivityIndicator color="#ef1b1b" /> : <Ionicons name={icon} size={28} color="#9ca3af" />}<Text className="text-foreground text-sm font-semibold mt-3">{title}</Text><Text className="text-muted-foreground text-xs text-center mt-1">{message}</Text>{actionLabel && onAction && <Pressable onPress={onAction} className="bg-primary rounded-lg px-4 py-2.5 mt-4"><Text className="text-primary-foreground text-xs font-semibold">{actionLabel}</Text></Pressable>}</View>;
}
