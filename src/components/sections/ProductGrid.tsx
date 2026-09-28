import { useWindowDimensions, View } from "react-native";
import type { Product } from "@/lib/data";
import { getResponsiveLayout, MAX_CONTENT_WIDTH } from "@/lib/responsive";
import { ProductCard } from "./ProductCard";

const GRID_GAP = 12;

type ProductGridProps = {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
};

export function ProductGrid({ products, onSelectProduct }: ProductGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const layout = getResponsiveLayout(screenWidth);
  const cardWidth = (layout.contentWidth - layout.horizontalPadding * 2 - GRID_GAP * (layout.productColumns - 1)) / layout.productColumns;

  return (
    <View
      className="flex-row flex-wrap self-center"
      style={{ gap: GRID_GAP, width: "100%", maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: layout.horizontalPadding }}
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
