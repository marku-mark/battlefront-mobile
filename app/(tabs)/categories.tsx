import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { categories } from "@/lib/data";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CategoriesScreen() {
  const [query, setQuery] = useState("");

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return categories;

    return categories.filter((category) =>
      category.name.toLowerCase().includes(normalizedQuery)
    );
  }, [query]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-3 pb-4 border-b border-border">
        <Text className="text-foreground text-2xl font-bold">Categories</Text>
        <Text className="text-muted-foreground text-sm mt-1">
          Find the right parts for your next build.
        </Text>

        <View className="flex-row items-center gap-2 bg-secondary rounded-md px-3 mt-4 h-11">
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            returnKeyType="search"
            className="flex-1 text-foreground text-sm"
          />
          {query.length > 0 && (
            <Pressable
              accessibilityLabel="Clear category search"
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View className="items-center py-12">
            <Ionicons name="search-outline" size={28} color="#9ca3af" />
            <Text className="text-foreground text-sm font-semibold mt-3">
              No categories found
            </Text>
            <Text className="text-muted-foreground text-xs mt-1">
              Try a different search term.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            className="flex-1 min-h-[128px] rounded-lg bg-card border border-border p-4 justify-between"
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <View className="w-11 h-11 rounded-md bg-secondary items-center justify-center">
              <Ionicons name={item.icon as any} size={24} color="#f8fafc" />
            </View>
            <View className="flex-row items-center justify-between mt-4">
              <Text className="text-foreground text-sm font-semibold">
                {item.name}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#ef1b1b" />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
