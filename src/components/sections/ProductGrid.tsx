import { useWindowDimensions, View } from "react-native";
import type { Product } from "@/lib/data";
import { ProductCard } from "./ProductCard";

const GRID_GAP = 12;
const HORIZONTAL_PADDING = 16;

type ProductGridProps = {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
};

export function ProductGrid({ products, onSelectProduct }: ProductGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(
    136,
    (screenWidth - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2
  );

  return (
    <View
      className="flex-row flex-wrap px-4"
      style={{ gap: GRID_GAP }}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          width={cardWidth}
          onPress={onSelectProduct}
        />
      ))}
    </View>
  );
}
