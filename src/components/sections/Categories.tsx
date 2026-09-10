import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, Text, View } from "react-native";
import type { Category } from "@/lib/data";

type CategoriesProps = {
  categories: Category[];
  onSelect?: (category: Category) => void;
};

export function Categories({ categories, onSelect }: CategoriesProps) {
  return (
    <View className="mt-6">
      <Text className="text-foreground font-semibold text-base px-4 mb-3">
        Categories
      </Text>
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect?.(item)}
            className="items-center w-16"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="w-14 h-14 rounded-lg bg-secondary items-center justify-center border border-border">
              <Ionicons name={item.icon as any} size={22} color="#f8fafc" />
            </View>
            <Text
              numberOfLines={1}
              className="text-muted-foreground text-xs mt-1.5 text-center"
            >
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
