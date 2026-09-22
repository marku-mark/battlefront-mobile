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
      style={({ pressed }) => ({ width, opacity: pressed ? 0.9 : 1 })}
      className="self-start"
    >
      <View className="rounded-xl overflow-hidden bg-card border border-border shadow-sm">
        <Image
          source={{ uri: product.image }}
          style={{ width: "100%", height: width * 0.96 }}
          resizeMode="cover"
        />
        {hasDiscount && (
          <View className="absolute top-2 left-2 bg-ring rounded-full px-1.5 py-0.5">
            <Text className="text-primary-foreground text-[10px] font-bold uppercase">
              -{discountPct}%
            </Text>
          </View>
        )}
      </View>

      <View className="mt-2.5">
        <Text numberOfLines={2} className="text-foreground text-[13px] font-medium leading-4">
          {product.name}
        </Text>

        <View className="flex-row items-end gap-1.5 mt-1.5">
          <Text className="text-primary font-bold text-sm">
            {formatPrice(product.price)}
          </Text>
          {hasDiscount && (
            <Text className="text-muted-foreground text-[11px] line-through mb-[1px]">
              {formatPrice(product.originalPrice!)}
            </Text>
          )}
        </View>

        {product.sold !== undefined && (
          <Text className="text-muted-foreground text-[10px] mt-1 uppercase tracking-[0.12em]">
            {product.sold} sold
          </Text>
        )}
      </View>
    </Pressable>
  );
}
