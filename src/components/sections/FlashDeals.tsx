import { Ionicons } from "@expo/vector-icons";
import { FlatList, Text, View } from "react-native";
import { useCountdown } from "@/hooks/useCountdown";
import type { Product } from "@/lib/data";
import { ProductCard } from "./ProductCard";

type FlashDealsProps = {
  products: Product[];
  endTime: Date;
  onSelectProduct?: (product: Product) => void;
};

export function FlashDeals({ products, endTime, onSelectProduct }: FlashDealsProps) {
  const { hours, minutes, seconds, isDone } = useCountdown(endTime);

  if (products.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="flash" size={18} color="#ef1b1b" />
          <Text className="text-foreground font-semibold text-base">
            Flash Deals
          </Text>
        </View>

        {!isDone ? (
          <View className="flex-row items-center gap-1">
            <TimeBlock value={hours} />
            <Text className="text-muted-foreground text-xs">:</Text>
            <TimeBlock value={minutes} />
            <Text className="text-muted-foreground text-xs">:</Text>
            <TimeBlock value={seconds} />
          </View>
        ) : (
          <Text className="text-muted-foreground text-xs">Deal ended</Text>
        )}
      </View>

      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <ProductCard product={item} width={140} onPress={onSelectProduct} />
        )}
      />
    </View>
  );
}

function TimeBlock({ value }: { value: string }) {
  return (
    <View className="bg-secondary rounded-sm px-1.5 py-0.5 min-w-[22px] items-center">
      <Text className="text-foreground text-xs font-semibold">{value}</Text>
    </View>
  );
}
