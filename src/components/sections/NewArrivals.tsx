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
      <Text className="text-foreground font-semibold text-base px-4 mb-3">
        New Arrivals
      </Text>
      <ProductGrid products={products} onSelectProduct={onSelectProduct} />
    </View>
  );
}
