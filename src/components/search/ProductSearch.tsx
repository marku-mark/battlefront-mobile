import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import type { Product } from "@/lib/data";
import { ProductCard } from "@/components/sections/ProductCard";

type ProductSearchProps = {
  visible: boolean;
  products: Product[];
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
};

export function ProductSearch({
  visible,
  products,
  onClose,
  onSelectProduct,
}: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        product.name.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery, products]
  );

  function handleClose() {
    setQuery("");
    onClose();
  }

  function handleSelectProduct(product: Product) {
    setQuery("");
    onSelectProduct(product);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 px-4 pt-3 pb-4 border-b border-border">
          <Pressable
            accessibilityLabel="Close product search"
            onPress={handleClose}
            hitSlop={10}
            className="w-9 h-9 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={22} color="#f8fafc" />
          </Pressable>
          <View className="flex-1 flex-row items-center gap-2 bg-secondary rounded-md px-3 h-11">
            <Ionicons name="search-outline" size={18} color="#9ca3af" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search parts, brands, builds"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              className="flex-1 text-foreground text-sm"
            />
            {query.length > 0 && (
              <Pressable accessibilityLabel="Clear product search" onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </Pressable>
            )}
          </View>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text className="text-muted-foreground text-xs mb-1">
              {normalizedQuery ? `${filteredProducts.length} results` : "Browse all products"}
            </Text>
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="search-outline" size={30} color="#9ca3af" />
              <Text className="text-foreground text-sm font-semibold mt-3">No products found</Text>
              <Text className="text-muted-foreground text-xs mt-1">Try another search term.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard product={item} width={150} onPress={handleSelectProduct} />
          )}
        />
      </View>
    </Modal>
  );
}
