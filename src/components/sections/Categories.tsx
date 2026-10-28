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

  const used = new Set<string>();
  const rules: [RegExp, keyof typeof Ionicons.glyphMap][] = [
    [/laptop|notebook/i, "laptop-outline"], [/monitor|display/i, "desktop-outline"],
    [/processor|cpu/i, "hardware-chip-outline"], [/graphic|gpu|video card/i, "videocam-outline"],
    [/motherboard/i, "git-network-outline"], [/memory|ram/i, "albums-outline"],
    [/storage|ssd|hard drive/i, "server-outline"], [/power|psu/i, "flash-outline"],
    [/cool|fan/i, "snow-outline"], [/case|chassis/i, "file-tray-stacked-outline"],
    [/keyboard/i, "keypad-outline"], [/mouse/i, "navigate-outline"],
    [/headset|headphone|audio/i, "headset-outline"], [/network|router/i, "wifi-outline"],
    [/cable|adapter/i, "link-outline"], [/desktop|computer|pc/i, "tv-outline"],
    [/accessor/i, "construct-outline"],
  ];
  const icons = new Map(categories.slice().sort((a, b) => a.id.localeCompare(b.id)).map(category => {
    const preferred = rules.find(([pattern]) => pattern.test(category.name))?.[1];
    const candidates = [preferred, category.icon, ...rules.map(([, icon]) => icon), ...Object.keys(Ionicons.glyphMap)];
    const icon = candidates.find(value => value && value in Ionicons.glyphMap && !used.has(value)) as keyof typeof Ionicons.glyphMap;
    used.add(icon);
    return [category.id, icon] as const;
  }));

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
            <View className="w-14 h-14 rounded-lg bg-secondary items-center justify-center border border-border">
              <Ionicons
                name={icons.get(item.id)}
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
