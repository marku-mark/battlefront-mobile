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
  const isHotPick = hasDiscount || (product.sold !== undefined && product.sold > 120);

  return (
    <Pressable
      onPress={() => onPress?.(product)}
      style={({ pressed }) => ({ width, opacity: pressed ? 0.94 : 1 })}
      className="self-start"
    >
      <View className="rounded-2xl overflow-hidden bg-card border border-border shadow-soft">
        <View className="relative">
          <Image
            source={{ uri: product.image }}
            style={{ width: "100%", height: width * 0.96 }}
            resizeMode="cover"
          />

          {hasDiscount && (
            <View className="absolute top-2 left-2 bg-ring rounded-full px-2 py-1">
              <Text className="text-primary-foreground text-[10px] font-bold uppercase tracking-[0.08em]">
                -{discountPct}%
              </Text>
            </View>
          )}

          {!hasDiscount && isHotPick && (
            <View className="absolute top-2 left-2 bg-primary/90 rounded-full px-2 py-1">
              <Text className="text-primary-foreground text-[10px] font-bold uppercase tracking-[0.08em]">
                Hot
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="mt-2.5 px-0.5">
        <Text numberOfLines={2} className="text-foreground text-[13px] font-semibold leading-4">
          {product.name}
        </Text>

        <View className="flex-row items-end gap-1.5 mt-2">
          <Text className="text-primary font-bold text-[15px]">
            {formatPrice(product.price)}
          </Text>
          {hasDiscount && (
            <Text className="text-muted-foreground text-[11px] line-through mb-[1px]">
              {formatPrice(product.originalPrice!)}
            </Text>
          )}
        </View>

        <View className="flex-row items-center justify-between mt-1.5">
          {product.sold !== undefined ? (
            <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
              {product.sold} sold
            </Text>
          ) : (
            <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
              Ready to ship
            </Text>
          )}

          {hasDiscount && (
            <Text className="text-ring text-[10px] font-bold uppercase tracking-[0.12em]">
              Save more
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
