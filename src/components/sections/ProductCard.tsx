import { Image, Pressable, Text, View } from "react-native";
import type { Product } from "@/lib/data";

type ProductCardProps = {
  product: Product;
  width?: number;
  onPress?: (product: Product) => void;
};

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export function ProductCard({ product, width = 150, onPress }: ProductCardProps) {
  const hasDiscount =
    product.originalPrice !== undefined && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.originalPrice! - product.price) / product.originalPrice!) * 100
      )
    : 0;

  return (
    <Pressable
      onPress={() => onPress?.(product)}
      style={({ pressed }) => ({ width, opacity: pressed ? 0.85 : 1 })}
    >
      <View className="rounded-lg overflow-hidden bg-card border border-border">
        <Image
          source={{ uri: product.image }}
          style={{ width: "100%", height: width }}
          resizeMode="cover"
        />
        {hasDiscount && (
          <View className="absolute top-1.5 left-1.5 bg-ring rounded-sm px-1.5 py-0.5">
            <Text className="text-foreground text-[10px] font-semibold">
              -{discountPct}%
            </Text>
          </View>
        )}
      </View>

      <Text numberOfLines={2} className="text-foreground text-xs mt-1.5 leading-4">
        {product.name}
      </Text>

      <View className="flex-row items-center gap-1.5 mt-1">
        <Text className="text-primary font-semibold text-sm">
          {formatPrice(product.price)}
        </Text>
        {hasDiscount && (
          <Text className="text-muted-foreground text-[11px] line-through">
            {formatPrice(product.originalPrice!)}
          </Text>
        )}
      </View>

      {product.sold !== undefined && (
        <Text className="text-muted-foreground text-[10px] mt-0.5">
          {product.sold} sold
        </Text>
      )}
    </Pressable>
  );
}
