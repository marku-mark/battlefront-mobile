import { Text, View } from "react-native";
import type { Product } from "@/lib/data";
import { ProductGrid } from "./ProductGrid";

type NewArrivalsProps = {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
};

export function NewArrivals({ products, onSelectProduct }: NewArrivalsProps) {
  if (products.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-foreground font-bold text-base">New Arrivals</Text>
        <Text className="text-muted-foreground text-[11px] uppercase tracking-[0.16em]">
          Fresh picks
        </Text>
      </View>
      <ProductGrid products={products} onSelectProduct={onSelectProduct} />
    </View>
  );
}
