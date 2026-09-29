import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingState } from "@/components/layout/LoadingState";
import { getBrands, getCategories, getProducts } from "@/lib/api";
import { getProductImageSource, type Brand, type Category, type Product } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";

const MAX_COMPARE_ITEMS = 3;
const LABEL_COLUMN_WIDTH = 110;
const PRODUCT_COLUMN_WIDTH = 200;

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export default function CompareScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { colors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isActive = true;
    Promise.all([getProducts(), getBrands(), getCategories()])
      .then(([loadedProducts, loadedBrands, loadedCategories]) => {
        if (!isActive) return;
        setProducts(loadedProducts);
        setBrands(loadedBrands);
        setCategories(loadedCategories);
      })
      .catch(() => {
        if (isActive) setHasError(true);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (productId && products.some((product) => product.id === productId)) {
      setSelectedIds((current) => current.includes(productId) ? current : [productId, ...current].slice(0, MAX_COMPARE_ITEMS));
    }
  }, [productId, products]);

  const selectedProducts = selectedIds
    .map((selectedId) => products.find((product) => product.id === selectedId))
    .filter((product): product is Product => Boolean(product));
  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return products
      .filter((product) => !selectedIds.includes(product.id) && product.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [products, query, selectedIds]);

  function toggleProduct(productIdToToggle: string) {
    setSelectedIds((current) => {
      if (current.includes(productIdToToggle)) return current.filter((id) => id !== productIdToToggle);
      if (current.length >= MAX_COMPARE_ITEMS) return current;
      return [...current, productIdToToggle];
    });
  }

  function brandName(product: Product): string {
    return brands.find((brand) => brand.id === product.brandId)?.name ?? "Not specified";
  }

  function categoryName(product: Product): string {
    return categories.find((category) => category.id === product.categoryId)?.name ?? "Not specified";
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View className="ml-2 flex-1">
          <Text className="text-foreground text-lg font-bold">Compare products</Text>
          <Text className="text-muted-foreground text-xs">Select up to {MAX_COMPARE_ITEMS} products</Text>
        </View>
        {selectedIds.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear comparison" onPress={() => setSelectedIds([])} hitSlop={8}>
            <Text className="text-primary text-xs font-semibold">Clear</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <LoadingState label="Loading products..." />
      ) : hasError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-foreground text-sm font-semibold">Couldn't load comparison data</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="mt-4 rounded-xl bg-primary px-5 py-3">
            <Text className="text-primary-foreground text-sm font-semibold">Go back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="px-4 pt-4">
            <View className="flex-row items-center rounded-xl border border-border bg-secondary px-3">
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                accessibilityLabel="Search products to compare"
                value={query}
                onChangeText={setQuery}
                placeholder="Search products to add"
                placeholderTextColor={colors.muted}
                className="h-11 flex-1 px-2 text-foreground text-sm"
              />
              {query.length > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>
            {query.trim().length > 0 && (
              <View className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
                {searchResults.map((product) => (
                  <Pressable
                    key={product.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${product.name} to comparison`}
                    disabled={selectedIds.length >= MAX_COMPARE_ITEMS}
                    onPress={() => toggleProduct(product.id)}
                    className="flex-row items-center border-b border-border px-3 py-2.5"
                    style={{ opacity: selectedIds.length >= MAX_COMPARE_ITEMS ? 0.5 : 1 }}
                  >
                    <Image source={getProductImageSource(product.image)} className="h-10 w-10 rounded-lg bg-secondary" />
                    <View className="ml-3 flex-1">
                      <Text className="text-foreground text-xs font-semibold" numberOfLines={1}>{product.name}</Text>
                      <Text className="text-muted-foreground text-[10px] mt-1">{formatPrice(product.price)}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  </Pressable>
                ))}
                {searchResults.length === 0 && <Text className="px-3 py-4 text-muted-foreground text-xs">No matching products.</Text>}
                {selectedIds.length >= MAX_COMPARE_ITEMS && <Text className="px-3 py-2 text-muted-foreground text-[10px]">Remove a product to add another.</Text>}
              </View>
            )}
          </View>

          {selectedProducts.length === 0 ? (
            <View className="items-center px-6 py-14">
              <Ionicons name="git-compare-outline" size={32} color={colors.muted} />
              <Text className="mt-3 text-foreground text-sm font-semibold">Choose products to compare</Text>
              <Text className="mt-1 text-center text-muted-foreground text-xs">Search for at least one item above to see its price, brand, rating, and availability.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <View style={{ width: LABEL_COLUMN_WIDTH + PRODUCT_COLUMN_WIDTH * selectedProducts.length }}>
                <View className="flex-row border-b border-border pb-3">
                  <View style={{ width: LABEL_COLUMN_WIDTH }} />
                  {selectedProducts.map((product) => (
                    <View key={product.id} style={{ width: PRODUCT_COLUMN_WIDTH }} className="px-2">
                      <View className="flex-row justify-end">
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${product.name} from comparison`} onPress={() => toggleProduct(product.id)} hitSlop={8}>
                          <Ionicons name="close-circle-outline" size={19} color={colors.muted} />
                        </Pressable>
                      </View>
                      <Image source={getProductImageSource(product.image)} className="h-24 w-24 self-center rounded-xl bg-card" resizeMode="cover" />
                      <Text className="mt-2 text-center text-foreground text-xs font-semibold" numberOfLines={3}>{product.name}</Text>
                      <Text className="mt-1 text-center text-primary text-sm font-bold">{formatPrice(product.price)}</Text>
                    </View>
                  ))}
                </View>
                <CompareRow label="Brand" values={selectedProducts.map(brandName)} />
                <CompareRow label="Category" values={selectedProducts.map(categoryName)} />
                <CompareRow label="Rating" values={selectedProducts.map((product) => product.rating && product.rating > 0 && product.reviewCount && product.reviewCount > 0 ? `${product.rating.toFixed(1)} / 5` : "No ratings yet")} />
                <CompareRow label="Reviews" values={selectedProducts.map((product) => `${product.reviewCount && product.reviewCount > 0 ? product.reviewCount : 0}`)} />
                <CompareRow label="Availability" values={selectedProducts.map((product) => product.stockQuantity === 0 ? "Out of stock" : product.stockQuantity === undefined ? "Available" : `${product.stockQuantity} in stock`)} />
                <CompareRow label="Options" values={selectedProducts.map((product) => product.variants?.join(", ") || "Standard")} />
              </View>
            </ScrollView>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <View className="flex-row border-b border-border py-3">
      <View style={{ width: LABEL_COLUMN_WIDTH }} className="justify-center pr-2">
        <Text className="text-muted-foreground text-[10px] font-semibold uppercase">{label}</Text>
      </View>
      {values.map((value, index) => (
        <View key={`${label}-${index}`} style={{ width: PRODUCT_COLUMN_WIDTH }} className="justify-center px-2">
          <Text className="text-foreground text-xs">{value}</Text>
        </View>
      ))}
    </View>
  );
}