import Ionicons from "@expo/vector-icons/Ionicons";
import { FlatList, Pressable, Text, View } from "react-native";
import type { Category } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";

type CategoriesProps = {
  categories: Category[];
  onSelect?: (category: Category) => void;
  onBrowseAll?: () => void;
};

export function Categories({ categories, onSelect, onBrowseAll }: CategoriesProps) {
  const { colors } = useTheme();

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View>
          <Text accessibilityRole="header" className="text-foreground font-bold text-lg">Shop by category</Text>
          <Text className="text-muted-foreground text-xs uppercase tracking-wide">
            find your fit
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Browse all categories"
          onPress={onBrowseAll}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <Text className="text-primary text-xs font-semibold uppercase tracking-wide">
            Browse all
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Browse ${item.name} category`}
            onPress={() => onSelect?.(item)}
            className="items-center w-[78px]"
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            <View className="w-14 h-14 rounded-xl bg-secondary items-center justify-center border border-border">
              <Ionicons
                name={item.icon as any}
                size={22}
                color={colors.foreground}
              />
            </View>
            <Text
              numberOfLines={2}
              className="text-muted-foreground text-xs mt-1.5 text-center leading-4"
            >
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
