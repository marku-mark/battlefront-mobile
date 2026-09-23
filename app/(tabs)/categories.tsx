import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
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
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId ?? null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<"all" | "under-5k" | "under-15k" | "over-15k">("all");
  const [sortOrder, setSortOrder] = useState<"featured" | "price-low" | "price-high">("featured");
  const { isDark } = useTheme();

  useEffect(() => {
    setSelectedCategoryId(categoryId ?? null);
  }, [categoryId]);

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]));
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
      const matchesCategory = !selectedCategoryId || product.categoryId === selectedCategoryId;
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
  }, [priceFilter, products, selectedBrandId, selectedCategoryId, sortOrder]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
      <ScreenHeader
        title="Categories"
        subtitle="Find the right parts for your next build."
      />
      <View className="px-4 pt-4">
        {selectedCategoryId && (
          <Text className="text-primary text-xs font-semibold mt-2">
            Category selected
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

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text className="text-muted-foreground text-xs uppercase tracking-[0.14em] mb-1">
            {query.trim() ? `${filteredCategories.length} results` : "Shop by needs"}
          </Text>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="search-outline" size={28} color={isDark ? "#9ca3af" : "#68717e"} />
            <Text className="text-foreground text-sm font-semibold mt-3">
              No categories found
            </Text>
            <Text className="text-muted-foreground text-xs mt-1">
              Try a different search term.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Browse ${item.name}`}
            accessibilityState={{ selected: selectedCategoryId === item.id }}
            onPress={() => setSelectedCategoryId(item.id)}
            className={`flex-1 min-h-[128px] rounded-2xl border p-4 justify-between ${
              selectedCategoryId === item.id
                ? "bg-primary/10 border-primary"
                : "bg-card border-border"
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <View className="w-11 h-11 rounded-xl bg-secondary items-center justify-center">
              <Ionicons name={item.icon as any} size={24} color={isDark ? "#f8fafc" : "#30343b"} />
            </View>
            <View className="flex-row items-center justify-between mt-4">
              <Text className="text-foreground text-sm font-semibold flex-1">
                {item.name}
              </Text>
              <Ionicons
                name={selectedCategoryId === item.id ? "checkmark-circle" : "arrow-forward"}
                size={16}
                color="#ef1b1b"
              />
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <View className="mt-6">
            <View className="flex-row items-end justify-between mb-3">
              <View>
                <Text className="text-foreground text-base font-bold">
                  {selectedCategory ? selectedCategory.name : "All products"}
                </Text>
                <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em] mt-1">
                  {previewProducts.length} available previews
                </Text>
              </View>
              {selectedCategoryId && (
                <Pressable
                  accessibilityLabel="Show all category products"
                  onPress={() => setSelectedCategoryId(null)}
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
                label={sortOrder === "featured" ? "Featured" : sortOrder === "price-low" ? "Price: low" : "Price: high"}
                active={sortOrder !== "featured"}
                onPress={() =>
                  setSortOrder((current) =>
                    current === "featured" ? "price-low" : current === "price-low" ? "price-high" : "featured"
                  )
                }
              />
              <FilterButton
                label={priceFilter === "all" ? "Any price" : priceFilter === "under-5k" ? "Under ₱5k" : priceFilter === "under-15k" ? "Under ₱15k" : "₱15k+"}
                active={priceFilter !== "all"}
                onPress={() =>
                  setPriceFilter((current) =>
                    current === "all" ? "under-5k" : current === "under-5k" ? "under-15k" : current === "under-15k" ? "over-15k" : "all"
                  )
                }
              />
              {brands.map((brand) => (
                <FilterButton
                  key={brand.id}
                  label={brand.name}
                  active={selectedBrandId === brand.id}
                  onPress={() => setSelectedBrandId((current) => current === brand.id ? null : brand.id)}
                />
              ))}
              {(selectedBrandId || priceFilter !== "all" || sortOrder !== "featured") && (
                <Pressable
                  accessibilityLabel="Reset category filters"
                  onPress={() => {
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
            {previewProducts.length > 0 ? (
              <ProductGrid products={previewProducts} />
            ) : (
              <View className="items-center border border-border bg-card py-8 px-4">
                <Text className="text-foreground text-sm font-semibold">
                  No products in this category yet
                </Text>
                <Text className="text-muted-foreground text-xs text-center mt-1">
                  Try another category or browse all products.
                </Text>
              </View>
            )}
          </View>
        }
      />
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
