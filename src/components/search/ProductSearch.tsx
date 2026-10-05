import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Product } from "@/lib/data";
import { ProductCard } from "@/components/sections/ProductCard";
import { LoadingMoreFooter } from "@/components/layout/LoadingMoreFooter";
import { getGridCardWidth, getResponsiveLayout, MAX_CONTENT_WIDTH } from "@/lib/responsive";
import { searchProductPage } from "@/lib/api";
import { createProgressiveCatalog } from "@/lib/catalogCache";
import { useTheme } from "@/theme/ThemeProvider";

type ProductSearchProps = { visible: boolean; products: Product[]; onClose: () => void; onSelectProduct: (product: Product) => void };

export function ProductSearch({ visible, products, onClose, onSelectProduct }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const { colors, reducedMotion } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const layout = getResponsiveLayout(width, fontScale);
  const list = useRef<FlashListRef<Product>>(null);
  const scrollOffset = useRef(0);
  const cache = useMemo(() => createProgressiveCatalog((page) => searchProductPage(term, page), 30_000), [term]);
  const [snapshot, setSnapshot] = useState(cache.snapshot);
  const [resultTerm, setResultTerm] = useState(term);
  const waiting = query.trim() !== term || resultTerm !== term;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => { setTerm(query.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [query, visible]);
  useEffect(() => {
    setSnapshot(cache.snapshot()); setResultTerm(term); scrollOffset.current = 0;
  }, [cache, term]);
  useEffect(() => {
    if (!visible || term.length < 2) return;
    const unsubscribe = cache.subscribe(setSnapshot);
    void cache.resume().catch(() => undefined);
    return unsubscribe;
  }, [cache, term, visible]);
  const loadMore = useCallback(() => {
    const current = cache.snapshot();
    if (visible && !waiting && term.length >= 2 && !current.loading && !current.complete && !current.error) void cache.next().catch(() => undefined);
  }, [cache, term, waiting, visible]);
  const select = useCallback((product: Product) => { onSelectProduct(product); }, [onSelectProduct]);
  const renderItem = useCallback(({ item }: { item: Product }) => <View style={{ paddingHorizontal: 6, marginBottom: 16 }}><ProductCard product={item} width={getGridCardWidth(width, layout.productColumns)} onPress={select} /></View>, [width, layout.productColumns, select]);
  const searching = waiting || snapshot.loading;
  const results = term.length >= 2 ? (resultTerm === term ? snapshot.rows : []) : products.slice(0, 12);

  return <Modal visible={visible} animationType={reducedMotion ? "none" : "slide"} onRequestClose={onClose}>
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View className="self-center w-full flex-row items-center gap-2 px-3 py-3 border-b border-border" style={{ maxWidth: MAX_CONTENT_WIDTH }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close product search" onPress={onClose} className="w-12 h-12 items-center justify-center"><Ionicons name="arrow-back" size={22} color={colors.icon} /></Pressable>
          <View className="flex-1 flex-row items-center gap-2 bg-secondary rounded-xl px-3 min-h-12 border border-border">
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput autoFocus value={query} onChangeText={setQuery} maxLength={255} placeholder="Search products or brands" placeholderTextColor={colors.muted} accessibilityLabel="Search products or brands" autoCapitalize="none" returnKeyType="search" className="flex-1 text-foreground text-base py-2" />
            {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear product search" onPress={() => { setQuery(""); setTerm(""); }} className="w-12 h-12 items-center justify-center"><Ionicons name="close-circle" size={20} color={colors.icon} /></Pressable>}
          </View>
        </View>
        <FlashList
          ref={list}
          key={"search-" + layout.productColumns}
          data={waiting ? [] : results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={layout.productColumns}
          onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
          onLoad={() => list.current?.scrollToOffset({ offset: scrollOffset.current, animated: false })}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 16, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={<View className="px-1.5 pb-4">
            <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-sm">{waiting ? "Searching…" : term.length < 2 ? (query ? "Enter at least 2 characters to search the full catalog." : "Browse products or search the full catalog.") : searching ? "Loading matches…" : snapshot.complete ? snapshot.rows.length + " results for “" + term + "”" : snapshot.rows.length + " matches loaded · scroll for more"}</Text>
            {snapshot.error && term.length >= 2 && !waiting && <View className="mt-3"><Text accessibilityRole="alert" className="text-danger text-sm">{snapshot.error.message}</Text><Pressable accessibilityRole="button" onPress={() => void cache.next().catch(() => undefined)} className="min-h-12 justify-center"><Text className="text-primary font-semibold">Retry search</Text></Pressable></View>}
          </View>}
          ListEmptyComponent={searching ? <View className="py-12"><ActivityIndicator color={colors.primary} accessibilityLabel="Searching products" /></View> : snapshot.error ? null : <View className="items-center px-6 py-12"><Text className="text-foreground text-base font-semibold">{term.length >= 2 ? "No matching products" : "Find your next upgrade"}</Text><Text className="text-muted-foreground text-sm mt-2 text-center">Try a product name or brand.</Text></View>}
          ListFooterComponent={snapshot.loading && results.length && !waiting ? <LoadingMoreFooter /> : null}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
