import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { stores, type Store } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";

export default function StoreLocatorScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [query, setQuery] = useState("");

  const filteredStores = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return stores;

    return stores.filter((store) =>
      [store.name, store.branch, store.city, store.address].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [query]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
        </Pressable>
        <View className="ml-2">
          <Text className="text-foreground text-lg font-bold">Store locations</Text>
          <Text className="text-muted-foreground text-xs mt-0.5">Visit a Battlefront branch</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      >
        <View className="flex-row items-center gap-2 bg-secondary border border-border rounded-xl px-3 h-11">
          <Ionicons name="search-outline" size={18} color={isDark ? "#cbd5e1" : "#68717e"} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by city or branch"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            returnKeyType="search"
            className="flex-1 text-foreground text-sm"
          />
          {query.length > 0 && (
            <Pressable accessibilityLabel="Clear store search" onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={isDark ? "#9ca3af" : "#68717e"} />
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center justify-between mt-6 mb-3">
          <Text className="text-foreground text-base font-bold">Our branches</Text>
          <Text className="text-muted-foreground text-xs">{filteredStores.length} locations</Text>
        </View>

        {filteredStores.map((store) => (
          <StoreCard key={store.id} store={store} isDark={isDark} />
        ))}

        {filteredStores.length === 0 && (
          <View className="items-center py-12">
            <Ionicons name="location-outline" size={30} color={isDark ? "#9ca3af" : "#68717e"} />
            <Text className="text-foreground text-sm font-semibold mt-3">No branches found</Text>
            <Text className="text-muted-foreground text-xs mt-1">Try another city or branch name.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StoreCard({ store, isDark }: { store: Store; isDark: boolean }) {
  function callStore() {
    Linking.openURL(`tel:${store.phone.replace(/[^\d+]/g, "")}`).catch(() => {
      Alert.alert("Unable to call", "Calling is not available on this device.");
    });
  }

  function openDirections() {
    const query = store.latitude !== undefined && store.longitude !== undefined
      ? `${store.latitude},${store.longitude}`
      : encodeURIComponent(`${store.name}, ${store.branch}, ${store.address}`);

    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {
      Alert.alert("Unable to open maps", "Directions are not available on this device.");
    });
  }

  return (
    <View className="bg-card border border-border rounded-2xl p-4 mb-3">
      <View className="flex-row items-start gap-3">
        <View className="w-10 h-10 rounded-xl bg-secondary items-center justify-center">
          <Ionicons name="storefront-outline" size={20} color={isDark ? "#f8fafc" : "#30343b"} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-base font-bold">{store.name}</Text>
          <Text className="text-primary text-xs font-bold mt-1">{store.branch}</Text>
          <Text className="text-muted-foreground text-xs mt-1 leading-4">{store.address}</Text>
          {store.landmark && (
            <View className="flex-row items-center gap-1.5 mt-2">
              <Ionicons name="navigate-outline" size={14} color={isDark ? "#cbd5e1" : "#68717e"} />
              <Text className="text-foreground text-xs font-medium">{store.landmark}</Text>
            </View>
          )}
        </View>
      </View>

      <View className="mt-4 pt-3 border-t border-border gap-2">
        <View className="flex-row items-start gap-2">
          <Ionicons name="time-outline" size={15} color={isDark ? "#cbd5e1" : "#68717e"} />
          <Text className="flex-1 text-muted-foreground text-xs leading-4">{store.hours}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="call-outline" size={15} color={isDark ? "#cbd5e1" : "#68717e"} />
          <Text className="text-muted-foreground text-xs">{store.phone}</Text>
        </View>
      </View>

      <View className="flex-row gap-2 mt-4">
        <Pressable
          onPress={callStore}
          accessibilityLabel={`Call ${store.name}`}
          className="flex-1 border border-border rounded-xl items-center py-2.5"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-foreground text-xs font-bold">Call branch</Text>
        </Pressable>
        <Pressable
          onPress={openDirections}
          accessibilityLabel={`Get directions to ${store.name}`}
          className="flex-1 bg-primary rounded-xl items-center py-2.5"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-primary-foreground text-xs font-bold">Get directions</Text>
        </Pressable>
      </View>
    </View>
  );
}