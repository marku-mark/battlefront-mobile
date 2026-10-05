import { FlatList, Text, View } from "react-native";
import type { Product } from "@/lib/data";
import { ProductCard } from "./ProductCard";

type SulitPicksProps = {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
};

export function SulitPicks({ products, onSelectProduct }: SulitPicksProps) {
  if (products.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View>
          <Text className="text-foreground font-bold text-base">Sulit Picks</Text>
        </View>
      </View>
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20, gap: 12 }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews
        renderItem={({ item }) => (
          <ProductCard product={item} width={140} onPress={onSelectProduct} />
        )}
      />
    </View>
  );
}
