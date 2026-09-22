import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, Text, View } from "react-native";
import type { Category } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";

type CategoriesProps = {
  categories: Category[];
  onSelect?: (category: Category) => void;
};

export function Categories({ categories, onSelect }: CategoriesProps) {
  const { isDark } = useTheme();

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-foreground font-bold text-base">Categories</Text>
        <Text className="text-muted-foreground text-[11px] uppercase tracking-[0.16em]">
          Browse all
        </Text>
      </View>
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
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            <View className="w-14 h-14 rounded-xl bg-secondary items-center justify-center border border-border">
              <Ionicons
                name={item.icon as any}
                size={22}
                color={isDark ? "#f8fafc" : "#30343b"}
              />
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
