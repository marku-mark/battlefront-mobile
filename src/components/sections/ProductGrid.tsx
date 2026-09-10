import { Dimensions, View } from "react-native";
import type { Product } from "@/lib/data";
import { ProductCard } from "./ProductCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 12;
const HORIZONTAL_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;

type ProductGridProps = {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
};

export function ProductGrid({ products, onSelectProduct }: ProductGridProps) {
  return (
    <View
      className="flex-row flex-wrap px-4"
      style={{ gap: GRID_GAP }}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          width={CARD_WIDTH}
          onPress={onSelectProduct}
        />
      ))}
    </View>
  );
}
