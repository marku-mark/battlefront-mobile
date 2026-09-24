import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { brands, categories, type Product } from "@/lib/data";
import { getProducts } from "@/lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ProductGrid } from "@/components/sections/ProductGrid";

export default function CategoriesScreen() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const [query, setQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(categoryId ? [categoryId] : []);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<"all" | "under-5k" | "under-15k" | "over-15k">("all");
  const [sortOrder, setSortOrder] = useState<"featured" | "price-low" | "price-high">("featured");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    setSelectedCategoryIds(categoryId ? [categoryId] : []);
  }, [categoryId]);

  useEffect(() => {
    setIsLoading(true);
    getProducts()
      .then(setProducts)
      .catch(() => {
        setProducts([]);
        setHasLoadError(true);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return categories;

    return categories.filter((category) =>
      category.name.toLowerCase().includes(normalizedQuery)
    );
  }, [query]);

  const previewProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(product.categoryId);
      const matchesBrand = !selectedBrandId || product.brandId === selectedBrandId;
      const matchesPrice =
        priceFilter === "all" ||
        (priceFilter === "under-5k" && product.price < 5000) ||
        (priceFilter === "under-15k" && product.price < 15000) ||
        (priceFilter === "over-15k" && product.price >= 15000);
      return matchesCategory && matchesBrand && matchesPrice;
    });

    return [...filtered].sort((left, right) => {
      if (sortOrder === "price-low") return left.price - right.price;
      if (sortOrder === "price-high") return right.price - left.price;
      return 0;
    });
  }, [priceFilter, products, selectedBrandId, selectedCategoryIds, sortOrder]);

  const selectedCategories = categories.filter((category) => selectedCategoryIds.includes(category.id));

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader
        title="Categories"
        subtitle="Find the right parts for your next build."
      />
      <View className="px-4 pt-4">
        {selectedCategoryIds.length > 0 && (
          <Text className="text-primary text-xs font-semibold mt-2">
            {selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? "y" : "ies"} selected
          </Text>
        )}

        <View className="flex-row items-center gap-2 bg-secondary border border-border rounded-xl px-3 mt-4 h-11">
          <Ionicons name="search-outline" size={18} color={isDark ? "#cbd5e1" : "#68717e"} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            returnKeyType="search"
            className="flex-1 text-foreground text-sm"
          />
          {query.length > 0 && (
            <Pressable
              accessibilityLabel="Clear category search"
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={isDark ? "#9ca3af" : "#68717e"} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text className="text-muted-foreground text-xs uppercase tracking-[0.14em] px-4 mt-5 mb-3">
          {query.trim() ? `${filteredCategories.length} results` : "Shop by needs"}
        </Text>
        {filteredCategories.length > 0 ? (
          <View className="flex-row flex-wrap gap-3 px-4">
            {filteredCategories.map((item) => (
              <Pressable
                key={item.id}
                accessibilityLabel={`Browse ${item.name}`}
                accessibilityState={{ selected: selectedCategoryIds.includes(item.id) }}
                onPress={() => setSelectedCategoryIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                className={`w-[48%] min-h-[128px] rounded-2xl border p-4 justify-between ${selectedCategoryIds.includes(item.id) ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              >
                <View className="w-11 h-11 rounded-xl bg-secondary items-center justify-center">
                  <Ionicons name={item.icon as any} size={24} color={isDark ? "#f8fafc" : "#30343b"} />
                </View>
                <View className="flex-row items-center justify-between mt-4">
                  <Text className="text-foreground text-sm font-semibold flex-1">{item.name}</Text>
                  <Ionicons name={selectedCategoryIds.includes(item.id) ? "checkmark-circle" : "arrow-forward"} size={16} color="#ef1b1b" />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="items-center py-12 px-4">
            <Ionicons name="search-outline" size={28} color={isDark ? "#9ca3af" : "#68717e"} />
            <Text className="text-foreground text-sm font-semibold mt-3">No categories found</Text>
            <Text className="text-muted-foreground text-xs mt-1">Try a different search term.</Text>
          </View>
        )}

        <View className="mt-6">
            <View className="flex-row items-end justify-between mb-3">
              <View>
                <Text className="text-foreground text-base font-bold">
                  {selectedCategories.length > 0 ? selectedCategories.map((category) => category.name).join(", ") : "All products"}
                </Text>
                <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em] mt-1">
                  {previewProducts.length} available previews
                </Text>
              </View>
              {selectedCategoryIds.length > 0 && (
                <Pressable
                  accessibilityLabel="Show all category products"
                  onPress={() => setSelectedCategoryIds([])}
                  hitSlop={8}
                >
                  <Text className="text-primary text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
            >
              <FilterButton
                label="Filter and sort"
                active={Boolean(selectedBrandId) || priceFilter !== "all" || sortOrder !== "featured"}
                onPress={() => setIsFilterOpen(true)}
              />
              {(selectedBrandId || priceFilter !== "all" || sortOrder !== "featured") && (
                <Pressable
                  accessibilityLabel="Reset category filters"
                  onPress={() => {
                    setSelectedCategoryIds([]);
                    setSelectedBrandId(null);
                    setPriceFilter("all");
                    setSortOrder("featured");
                  }}
                  className="h-9 justify-center px-2"
                >
                  <Text className="text-primary text-[11px] font-semibold uppercase tracking-[0.1em]">
                    Reset
                  </Text>
                </Pressable>
              )}
            </ScrollView>
            {isLoading ? (
              <View className="items-center border border-border bg-card py-10 px-4">
                <ActivityIndicator color="#ef1b1b" />
                <Text className="text-muted-foreground text-xs mt-3">Loading products...</Text>
              </View>
            ) : hasLoadError ? (
              <View className="items-center border border-border bg-card py-8 px-4">
                <Ionicons name="cloud-offline-outline" size={28} color={isDark ? "#9ca3af" : "#68717e"} />
                <Text className="text-foreground text-sm font-semibold mt-3">Could not load products</Text>
                <Text className="text-muted-foreground text-xs text-center mt-1">Check your connection and try again.</Text>
                <Pressable
                  onPress={() => {
                    setIsLoading(true);
                    setHasLoadError(false);
                    getProducts()
                      .then(setProducts)
                      .catch(() => setHasLoadError(true))
                      .finally(() => setIsLoading(false));
                  }}
                  className="bg-primary rounded-lg px-4 py-2.5 mt-4"
                >
                  <Text className="text-primary-foreground text-xs font-semibold">Try again</Text>
                </Pressable>
              </View>
            ) : previewProducts.length > 0 ? (
              <ProductGrid
                products={previewProducts}
                onSelectProduct={(product) =>
                  router.push({ pathname: "/product/[id]", params: { id: product.id } })
                }
              />
            ) : (
              <View className="items-center border border-border bg-card py-8 px-4">
                <Ionicons name="search-outline" size={26} color={isDark ? "#9ca3af" : "#68717e"} />
                <Text className="text-foreground text-sm font-semibold">
                  No products match these filters
                </Text>
                <Text className="text-muted-foreground text-xs text-center mt-1">
                  Clear a filter or choose another category to continue browsing.
                </Text>
                <Pressable
                  onPress={() => {
                    setSelectedBrandId(null);
                    setPriceFilter("all");
                    setSortOrder("featured");
                  }}
                  className="border border-border rounded-lg px-4 py-2.5 mt-4"
                >
                  <Text className="text-foreground text-xs font-semibold">Clear filters</Text>
                </Pressable>
              </View>
            )}
          </View>
      </ScrollView>
      <Modal
        visible={isFilterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFilterOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl border-t border-border px-4 pt-4 pb-8">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-lg font-bold">Filter and sort</Text>
              <Pressable
                accessibilityLabel="Close filters"
                onPress={() => setIsFilterOpen(false)}
                hitSlop={8}
                className="w-9 h-9 items-center justify-center"
              >
                <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
              </Pressable>
            </View>
            <Text className="text-muted-foreground text-xs uppercase tracking-[0.12em] mt-5 mb-2">Sort by</Text>
            <View className="flex-row flex-wrap gap-2">
              <FilterButton label="Featured" active={sortOrder === "featured"} onPress={() => setSortOrder("featured")} />
              <FilterButton label="Price: low" active={sortOrder === "price-low"} onPress={() => setSortOrder("price-low")} />
              <FilterButton label="Price: high" active={sortOrder === "price-high"} onPress={() => setSortOrder("price-high")} />
            </View>
            <Text className="text-muted-foreground text-xs uppercase tracking-[0.12em] mt-5 mb-2">Price</Text>
            <View className="flex-row flex-wrap gap-2">
              <FilterButton label="Any price" active={priceFilter === "all"} onPress={() => setPriceFilter("all")} />
              <FilterButton label="Under ₱5k" active={priceFilter === "under-5k"} onPress={() => setPriceFilter("under-5k")} />
              <FilterButton label="Under ₱15k" active={priceFilter === "under-15k"} onPress={() => setPriceFilter("under-15k")} />
              <FilterButton label="₱15k+" active={priceFilter === "over-15k"} onPress={() => setPriceFilter("over-15k")} />
            </View>
            <Text className="text-muted-foreground text-xs uppercase tracking-[0.12em] mt-5 mb-2">Brand</Text>
            <View className="flex-row flex-wrap gap-2">
              {brands.map((brand) => (
                <FilterButton
                  key={brand.id}
                  label={brand.name}
                  active={selectedBrandId === brand.id}
                  onPress={() => setSelectedBrandId((current) => current === brand.id ? null : brand.id)}
                />
              ))}
            </View>
            <Pressable onPress={() => setIsFilterOpen(false)} className="bg-primary rounded-xl items-center py-3.5 mt-6">
              <Text className="text-primary-foreground text-sm font-bold">Show {previewProducts.length} products</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`h-9 justify-center rounded-lg border px-3 ${active ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text className={`text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
