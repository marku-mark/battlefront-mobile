import { FlatList, Text, View } from "react-native";
import type { Brand } from "@/lib/data";

type BrandsProps = {
  brands: Brand[];
};

export function Brands({ brands }: BrandsProps) {
  if (brands.length === 0) return null;

  return (
    <View className="mt-6 mb-4">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-foreground font-bold text-base">Brands</Text>
      </View>
      <FlatList
        data={brands}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20, gap: 10 }}
        renderItem={({ item }) => (
          <View className="border border-border rounded-xl bg-card min-w-[96px] px-4 py-3.5 items-center justify-center">
            <Text className="text-foreground text-xs font-bold uppercase tracking-[0.08em]">
              {item.name}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
