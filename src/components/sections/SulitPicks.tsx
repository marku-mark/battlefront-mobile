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
          <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em]">
            best value everyday
          </Text>
        </View>
        <Text className="text-muted-foreground text-[11px] uppercase tracking-[0.16em]">
          Smart buys
        </Text>
      </View>
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20, gap: 12 }}
        renderItem={({ item }) => (
          <ProductCard product={item} width={140} onPress={onSelectProduct} />
        )}
      />
    </View>
  );
}
