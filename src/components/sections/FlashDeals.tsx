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
          <View className="w-7 h-7 rounded-full bg-ring/15 items-center justify-center">
            <Ionicons name="flash" size={16} color="#ef4444" />
          </View>
          <View>
            <Text className="text-foreground font-bold text-base">
              Flash Deals
            </Text>
            <Text className="text-muted-foreground text-[10px] uppercase tracking-[0.14em]">
              limited time offers
            </Text>
          </View>
        </View>

        {!isDone ? (
          <View className="items-end">
            <Text className="text-muted-foreground text-[9px] uppercase tracking-[0.14em] mb-1.5">
              Ends in
            </Text>
            <View className="flex-row items-center gap-1.5">
              <TimeBlock value={hours} />
              <Text className="text-muted-foreground text-[10px] font-bold">:</Text>
              <TimeBlock value={minutes} />
              <Text className="text-muted-foreground text-[10px] font-bold">:</Text>
              <TimeBlock value={seconds} />
            </View>
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20, gap: 12 }}
        renderItem={({ item }) => (
          <ProductCard product={item} width={140} onPress={onSelectProduct} />
        )}
      />
    </View>
  );
}

function TimeBlock({ value }: { value: string }) {
  return (
    <View className="bg-card border border-border rounded-md px-1.5 py-1 min-w-[25px] items-center">
      <Text className="text-foreground text-[10px] font-bold">{value}</Text>
    </View>
  );
}
