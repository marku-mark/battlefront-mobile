import { Text, View, useWindowDimensions } from "react-native";
import type { Product } from "@/lib/data";
import { getGridCardWidth, getResponsiveLayout } from "@/lib/responsive";
import { ProductCard } from "./ProductCard";

type SulitPicksProps = {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
};

export function SulitPicks({ products, onSelectProduct }: SulitPicksProps) {
  const { width, fontScale } = useWindowDimensions();
  const { productColumns } = getResponsiveLayout(width, fontScale);
  const cardWidth = getGridCardWidth(width, productColumns);
  if (products.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="px-4 mb-3">
        <Text className="text-foreground font-bold text-base">Sulit Picks</Text>
      </View>
      {Array.from({ length: Math.ceil(products.length / productColumns) }, (_, row) => (
        <View key={row} className="flex-row items-stretch px-2.5 pb-3">
          {products.slice(row * productColumns, (row + 1) * productColumns).map((product) => (
            <View key={product.id} style={{ width: cardWidth + 12, paddingHorizontal: 6 }}>
              <ProductCard product={product} width={cardWidth} stretch onPress={onSelectProduct} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
