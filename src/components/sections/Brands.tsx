import { FlatList, Text, View } from "react-native";
import type { Brand } from "@/lib/data";

type BrandsProps = {
  brands: Brand[];
};

export function Brands({ brands }: BrandsProps) {
  if (brands.length === 0) return null;

  return (
    <View className="mt-6 mb-4">
      <Text className="text-foreground font-semibold text-base px-4 mb-3">
        Brands
      </Text>
      <FlatList
        data={brands}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View className="border border-border rounded-md px-4 py-3 items-center justify-center">
            <Text className="text-foreground text-sm font-medium">{item.name}</Text>
          </View>
        )}
      />
    </View>
  );
}
