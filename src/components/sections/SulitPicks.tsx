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
      <Text className="text-foreground font-semibold text-base px-4 mb-3">
        Sulit Picks
      </Text>
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <ProductCard product={item} width={140} onPress={onSelectProduct} />
        )}
      />
    </View>
  );
}
