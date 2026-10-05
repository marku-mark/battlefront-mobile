import { ProductImage } from "@/components/products/ProductImage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/hooks/useCart";
import { getBrands, getCatalogPreview, getCatalogSnapshot, subscribeCatalog } from "@/lib/api";
import { getProductImageSource, type Brand, type Product } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";
import { LoadingMoreFooter } from "@/components/layout/LoadingMoreFooter";
import { ConfirmClearModal } from "@/components/layout/ConfirmClearModal";
import { MAX_CONTENT_WIDTH } from "@/lib/responsive";

const BUILD_STORAGE_KEY = "battlefront-api-saved-builds";
const PARTS_PER_PAGE = 20;
const PAGE_LOAD_DELAY_MS = 250;

const BUILDER_SLOTS = [
  { id: "cpu", label: "Processor", categoryId: "category-processor", required: true },
  { id: "motherboard", label: "Motherboard", categoryId: "category-motherboard", required: true },
  { id: "memory", label: "Memory", categoryId: "category-ram", required: true },
  { id: "graphics", label: "Graphics card", categoryId: "category-graphics-card", required: false },
  { id: "storage", label: "Storage", categoryId: "category-storage", required: true },
  { id: "power", label: "Power supply", categoryId: "category-power-supply", required: true },
  { id: "case", label: "Case", categoryId: "category-pc-case", required: true },
  { id: "cooling", label: "Cooling", categoryId: "category-cooling-components", required: false },
] as const;

type BuilderSlot = (typeof BUILDER_SLOTS)[number];
type BuilderSlotId = BuilderSlot["id"];
type BuildSelection = Partial<Record<BuilderSlotId, Product>>;
type SavedBuild = {
  id: string;
  name: string;
  savedAt: string;
  selections: Partial<Record<BuilderSlotId, string>>;
};
type BuilderNotice = { type: "success" | "warning" | "error"; message: string };

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function haveSameComponents(
  first: SavedBuild["selections"],
  second: SavedBuild["selections"]
): boolean {
  const firstIds = Object.values(first).filter((id): id is string => Boolean(id)).sort();
  const secondIds = Object.values(second).filter((id): id is string => Boolean(id)).sort();
  return firstIds.length > 0 && firstIds.length === secondIds.length && firstIds.every((id, index) => id === secondIds[index]);
}

export default function BuilderScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>(() => getCatalogSnapshot().rows);
  const [visiblePartCount, setVisiblePartCount] = useState(PARTS_PER_PAGE);
  const [isLoadingMoreParts, setIsLoadingMoreParts] = useState(false);
  const isLoadingMorePartsRef = useRef(false);
  const loadMorePartsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selection, setSelection] = useState<BuildSelection>({});
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [buildToDelete, setBuildToDelete] = useState<SavedBuild | null>(null);
  const [builderNotice, setBuilderNotice] = useState<BuilderNotice | null>(null);
  const isSavingBuildRef = useRef(false);
  const builderNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSlot, setActiveSlot] = useState<BuilderSlot | null>(null);
  const [isSavedBuildsOpen, setIsSavedBuildsOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [partsAddedSummary, setPartsAddedSummary] = useState<{ count: number; subtotal: number } | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(() => getCatalogSnapshot().rows.length === 0);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useFocusEffect(useCallback(() => {
    let isActive = true;
    setIsLoading(getCatalogSnapshot().rows.length === 0);
    setHasLoadError(false);

    const unsubscribe = subscribeCatalog((snapshot) => {
      if (!isActive) return;
      if (snapshot.rows.length || snapshot.complete) { setProducts(snapshot.rows); setIsLoading(false); }
      if (snapshot.error) setHasLoadError(true);
    });
    Promise.all([getCatalogPreview(), getBrands(), AsyncStorage.getItem(BUILD_STORAGE_KEY)])
      .then(([catalog, catalogBrands, storedBuilds]) => {
        if (!isActive) return;
        setProducts(catalog);
        setBrands(catalogBrands);
        if (storedBuilds) {
          const parsed = JSON.parse(storedBuilds) as SavedBuild[];
          setSavedBuilds(Array.isArray(parsed) ? parsed : []);
        }
      })
      .catch(() => {
        if (isActive) setHasLoadError(true);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [retryCount]));

  const visibleProducts = useMemo(() => {
    if (!activeSlot) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return products
      .filter((product) => product.categorySlug === activeSlot.categoryId)
      .filter((product) => !normalizedQuery || `${product.name} ${product.brandId}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => left.price - right.price);
  }, [activeSlot, products, query]);
  const visiblePartProducts = useMemo(
    () => visibleProducts.slice(0, visiblePartCount),
    [visiblePartCount, visibleProducts]
  );

  useEffect(() => {
    if (loadMorePartsTimerRef.current) clearTimeout(loadMorePartsTimerRef.current);
    loadMorePartsTimerRef.current = null;
    isLoadingMorePartsRef.current = false;
    setIsLoadingMoreParts(false);
    setVisiblePartCount(PARTS_PER_PAGE);
  }, [activeSlot, query]);

  useEffect(() => () => {
    if (loadMorePartsTimerRef.current) clearTimeout(loadMorePartsTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (builderNoticeTimeoutRef.current) clearTimeout(builderNoticeTimeoutRef.current);
  }, []);

  function showBuilderNotice(type: BuilderNotice["type"], message: string) {
    if (builderNoticeTimeoutRef.current) clearTimeout(builderNoticeTimeoutRef.current);
    setBuilderNotice({ type, message });
    builderNoticeTimeoutRef.current = null;
    if (type === "success") {
      builderNoticeTimeoutRef.current = setTimeout(() => {
        setBuilderNotice(null);
        builderNoticeTimeoutRef.current = null;
      }, 3000);
    }
  }

  function clearBuilderNotice() {
    if (builderNoticeTimeoutRef.current) clearTimeout(builderNoticeTimeoutRef.current);
    builderNoticeTimeoutRef.current = null;
    setBuilderNotice(null);
  }

  function loadMoreParts() {
    if (isLoadingMorePartsRef.current || visiblePartCount >= visibleProducts.length) return;
    isLoadingMorePartsRef.current = true;
    setIsLoadingMoreParts(true);
    loadMorePartsTimerRef.current = setTimeout(() => {
      setVisiblePartCount((current) => Math.min(current + PARTS_PER_PAGE, visibleProducts.length));
      setIsLoadingMoreParts(false);
      isLoadingMorePartsRef.current = false;
      loadMorePartsTimerRef.current = null;
    }, PAGE_LOAD_DELAY_MS);
  }

  const selectedProducts = useMemo(
    () => BUILDER_SLOTS.flatMap((slot) => selection[slot.id] ? [selection[slot.id]!] : []),
    [selection]
  );
  const selectedRequiredCount = BUILDER_SLOTS.filter((slot) => slot.required && selection[slot.id]).length;
  const requiredSlotCount = BUILDER_SLOTS.filter((slot) => slot.required).length;
  const subtotal = selectedProducts.reduce((total, product) => total + product.price, 0);

  function selectProduct(slot: BuilderSlot, product: Product) {
    setSelection((current) => ({ ...current, [slot.id]: product }));
    clearBuilderNotice();
    setActiveSlot(null);
    setQuery("");
  }

  function removeProduct(slotId: BuilderSlotId) {
    setSelection((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
    clearBuilderNotice();
  }

  async function saveBuilds(nextBuilds: SavedBuild[]) {
    if (isSavingBuildRef.current) return;
    isSavingBuildRef.current = true;
    try {
      await AsyncStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(nextBuilds));
      setSavedBuilds(nextBuilds);
      showBuilderNotice("success", "Build saved on this device.");
    } catch {
      showBuilderNotice("error", "Could not save build. Check device storage and try again.");
    } finally {
      isSavingBuildRef.current = false;
    }
  }

  async function deleteSavedBuild(build: SavedBuild) {
    const nextBuilds = savedBuilds.filter((savedBuild) => savedBuild.id !== build.id);
    try {
      await AsyncStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(nextBuilds));
      setSavedBuilds(nextBuilds);
      setBuildToDelete(null);
    } catch {
      Alert.alert("Could not delete build", "Try again after checking device storage.");
    }
  }

  function saveCurrentBuild() {
    if (selectedProducts.length === 0) return;
    const savedAt = new Date().toISOString();
    const savedSelection = Object.fromEntries(
      BUILDER_SLOTS.flatMap((slot) => selection[slot.id] ? [[slot.id, selection[slot.id]!.id]] : [])
    ) as SavedBuild["selections"];
    const duplicateBuild = savedBuilds.find((build) => haveSameComponents(build.selections, savedSelection));
    if (duplicateBuild) {
      showBuilderNotice("warning", `These components are already saved as ${duplicateBuild.name}. Change a component before saving another build.`);
      return;
    }

    const build: SavedBuild = {
      id: `${Date.now()}`,
      name: `Build ${new Date(savedAt).toLocaleDateString("en-PH")}`,
      savedAt,
      selections: savedSelection,
    };
    void saveBuilds([build, ...savedBuilds]);
  }

  function loadBuild(build: SavedBuild) {
    const nextSelection: BuildSelection = {};
    for (const slot of BUILDER_SLOTS) {
      const productId = build.selections[slot.id];
      const product = products.find((candidate) => candidate.id === productId);
      if (product) nextSelection[slot.id] = product;
    }
    setSelection(nextSelection);
    setIsSavedBuildsOpen(false);
  }

  function clearBuild() {
    setIsClearConfirmOpen(true);
  }

  async function shareBuild() {
    const parts = BUILDER_SLOTS.flatMap((slot) => {
      const product = selection[slot.id];
      return product ? [`${slot.label}: ${product.name} (${formatPrice(product.price)})`] : [];
    });
    if (parts.length === 0) return;
    await Share.share({
      title: "My Battlefront PC build",
      message: `My Battlefront PC build\n${parts.join("\n")}\nSubtotal: ${formatPrice(subtotal)}\nCompatibility and power estimates are unavailable.`,
    });
  }

  async function addBuildToCart() {
    if (selectedProducts.length === 0) return;
    let count = 0;
    let addedSubtotal = 0;
    for (const product of selectedProducts) {
      if (!await addItem(product)) break;
      count++; addedSubtotal += product.price;
    }
    if (count > 0) setPartsAddedSummary({ count, subtotal: addedSubtotal });
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Pressable onPress={() => router.push("/recommendations")} className="px-4 py-3 border-b border-border"><Text className="text-primary font-semibold">Find products for your budget</Text></Pressable>
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Ionicons name="arrow-back" size={21} color={isDark ? "#f8fafc" : "#30343b"} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-foreground text-lg font-bold">PC Builder</Text>
          <Text className="text-muted-foreground text-xs">Select parts for your setup</Text>
        </View>
        <Pressable accessibilityLabel="Clear current build" onPress={clearBuild} disabled={selectedProducts.length === 0} className="h-10 w-10 items-center justify-center rounded-lg bg-secondary disabled:opacity-40">
          <Ionicons name="trash-outline" size={19} color={isDark ? "#cbd5e1" : "#59616d"} />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color="#ef1b1b" />
          <Text className="text-muted-foreground text-sm">Loading parts catalog</Text>
        </View>
      ) : hasLoadError && products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={30} color={isDark ? "#9ca3af" : "#68717e"} />
          <Text className="mt-3 text-foreground text-base font-semibold">Could not load the catalog</Text>
          <Text className="mt-1 text-center text-muted-foreground text-sm">The builder needs the local product catalog to show available parts.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryCount((count) => count + 1)}
            className="mt-5 rounded-xl bg-primary px-5 py-3"
          >
            <Text className="text-primary-foreground text-sm font-semibold">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, width: "100%", maxWidth: 960, alignSelf: "center" }}>
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">Required components</Text>
                <Text className="mt-1 text-foreground text-sm font-bold">{selectedRequiredCount} of {requiredSlotCount} selected</Text>
              </View>
              <View className="flex-row gap-2">
                <ActionButton icon="folder-open-outline" label="Load" onPress={() => setIsSavedBuildsOpen(true)} disabled={savedBuilds.length === 0} />
                <ActionButton icon="save-outline" label="Save" onPress={saveCurrentBuild} disabled={selectedProducts.length === 0} />
              </View>
            </View>

            {builderNotice && (
              <View className={`mb-4 flex-row items-start gap-2 rounded-lg border px-3 py-2.5 ${builderNotice.type === "success" ? "border-success/40 bg-success/10" : builderNotice.type === "warning" ? "border-primary/40 bg-primary/10" : "border-danger/40 bg-danger/10"}`}>
                <Ionicons
                  name={builderNotice.type === "success" ? "checkmark-circle-outline" : "alert-circle-outline"}
                  size={17}
                  color={builderNotice.type === "success" ? "#16a34a" : builderNotice.type === "warning" ? "#ef1b1b" : "#ef4444"}
                />
                <Text accessibilityRole="alert" className="flex-1 text-foreground text-xs leading-5">
                  {builderNotice.message}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss build message"
                  onPress={clearBuilderNotice}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={17} color={isDark ? "#cbd5e1" : "#59616d"} />
                </Pressable>
              </View>
            )}

            <View className="gap-2">
              {BUILDER_SLOTS.map((slot) => (
                <BuilderSlotCard
                  key={slot.id}
                  slot={slot}
                  product={selection[slot.id]}
                  isDark={isDark}
                  onSelect={() => { setActiveSlot(slot); setQuery(""); }}
                  onRemove={() => removeProduct(slot.id)}
                />
              ))}
            </View>

            <View className="mt-5 rounded-xl border border-border bg-card p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground text-base font-bold">Build summary</Text>
                <Text className="text-muted-foreground text-xs">{selectedProducts.length} parts</Text>
              </View>
              <View className="mt-4 flex-row gap-2">
                <SummaryMetric icon="flash-outline" label="Estimated power" value="Unavailable" />
                <SummaryMetric icon="git-branch-outline" label="Compatibility" value="Not checked" />
              </View>
              <Text className="mt-3 text-muted-foreground text-xs leading-5">
                The catalog does not include structured hardware specifications yet. Compatibility and power cannot be verified for these parts.
              </Text>
              <View className="mt-4 flex-row items-center justify-between border-t border-border pt-3">
                <Text className="text-foreground text-sm font-semibold">Parts subtotal</Text>
                <Text className="text-primary text-base font-bold">{formatPrice(subtotal)}</Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-2">
              <Pressable accessibilityRole="button" accessibilityLabel="Share build" onPress={() => void shareBuild()} disabled={selectedProducts.length === 0} className="h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary disabled:opacity-40">
                <Ionicons name="share-outline" size={19} color={isDark ? "#f8fafc" : "#30343b"} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={addBuildToCart} disabled={selectedProducts.length === 0} className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary disabled:opacity-40">
                <Ionicons name="cart-outline" size={18} color="#fff" />
                <Text className="text-primary-foreground text-sm font-bold">Add selected parts to cart</Text>
              </Pressable>
            </View>
          </ScrollView>
        </>
      )}

      <Modal visible={activeSlot !== null} animationType="slide" onRequestClose={() => setActiveSlot(null)}>
        <SafeAreaView className="flex-1 bg-background">
          <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
            <Pressable accessibilityLabel="Close part selector" onPress={() => setActiveSlot(null)} className="h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-foreground text-base font-bold">Choose {activeSlot?.label.toLowerCase()}</Text>
              <Text className="text-muted-foreground text-xs">{visibleProducts.length} parts in the local catalog</Text>
            </View>
            {activeSlot && selection[activeSlot.id] && (
              <Pressable onPress={() => removeProduct(activeSlot.id)} className="px-2 py-2">
                <Text className="text-primary text-xs font-semibold">Remove</Text>
              </Pressable>
            )}
          </View>
          <View className="mx-4 mt-4 h-11 flex-row items-center gap-2 rounded-lg border border-border bg-secondary px-3">
            <Ionicons name="search-outline" size={18} color={isDark ? "#cbd5e1" : "#68717e"} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search parts" placeholderTextColor="#94a3b8" autoCapitalize="none" returnKeyType="search" className="flex-1 text-foreground text-sm" />
            {query.length > 0 && <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={isDark ? "#9ca3af" : "#68717e"} /></Pressable>}
          </View>
          <FlatList
            data={visiblePartProducts}
            keyExtractor={(product) => product.id}
            onEndReached={loadMoreParts}
            onEndReachedThreshold={0.4}
            ListFooterComponent={isLoadingMoreParts ? <LoadingMoreFooter /> : null}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            ListEmptyComponent={<View className="flex-1 items-center justify-center px-8"><Ionicons name="cube-outline" size={30} color={isDark ? "#9ca3af" : "#68717e"} /><Text className="mt-3 text-foreground text-sm font-semibold">No matching parts</Text><Text className="mt-1 text-center text-muted-foreground text-xs">Try another search or check back when this category has catalog items.</Text></View>}
            renderItem={({ item }) => (
              <PartOption
                product={item}
                brandName={brands.find((brand) => brand.id === item.brandId)?.name ?? item.brandId}
                selected={activeSlot ? selection[activeSlot.id]?.id === item.id : false}
                isDark={isDark}
                onPress={() => activeSlot && selectProduct(activeSlot, item)}
              />
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={isSavedBuildsOpen} animationType="slide" onRequestClose={() => setIsSavedBuildsOpen(false)}>
        <SafeAreaView className="flex-1 bg-background">
          <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
            <Pressable accessibilityLabel="Close saved builds" onPress={() => setIsSavedBuildsOpen(false)} className="h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-foreground text-base font-bold">Saved builds</Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                {savedBuilds.length} saved {savedBuilds.length === 1 ? "configuration" : "configurations"}
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, width: "100%", maxWidth: 760, alignSelf: "center" }}>
            {savedBuilds.length === 0 ? (
              <View className="items-center py-16 px-6">
                <View className="h-14 w-14 items-center justify-center rounded-xl border border-border bg-secondary">
                  <Ionicons name="desktop-outline" size={26} color={isDark ? "#9ca3af" : "#68717e"} />
                </View>
                <Text className="mt-4 text-foreground text-base font-semibold">No saved builds yet</Text>
                <Text className="mt-1 text-center text-muted-foreground text-sm">
                  Save your current parts selection to find it here later.
                </Text>
              </View>
            ) : savedBuilds.map((build) => {
              const buildProducts = BUILDER_SLOTS.flatMap((slot) => {
                const productId = build.selections[slot.id];
                const product = products.find((item) => item.id === productId);
                return product ? [product] : [];
              });
              const partCount = Object.keys(build.selections).length;
              const buildSubtotal = buildProducts.reduce((total, product) => total + product.price, 0);
              const previewNames = buildProducts.slice(0, 2).map((product) => product.name).join(" · ");
              return (
                <View key={build.id} className="rounded-xl border border-border bg-card p-4">
                  <View className="flex-row items-start gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <Ionicons name="desktop-outline" size={20} color={isDark ? "#cbd5e1" : "#59616d"} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground text-sm font-semibold">{build.name}</Text>
                      <Text className="mt-1 text-muted-foreground text-xs">
                        Saved {new Date(build.savedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete saved build ${build.name}`}
                      onPress={() => setBuildToDelete(build)}
                      className="h-9 w-9 items-center justify-center rounded-lg border border-border"
                      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                    >
                      <Ionicons name="trash-outline" size={17} color="#ef1b1b" />
                    </Pressable>
                  </View>
                  <Text numberOfLines={2} className="mt-3 text-muted-foreground text-xs leading-5">
                    {previewNames || "Some saved parts are no longer in the catalog"}
                    {buildProducts.length > 2 ? ` · +${buildProducts.length - 2} more` : ""}
                  </Text>
                  <View className="mt-3 flex-row items-center justify-between border-t border-border pt-3">
                    <Text className="text-muted-foreground text-xs">
                      {partCount} {partCount === 1 ? "part" : "parts"}
                    </Text>
                    <Text className="text-foreground text-sm font-bold">{formatPrice(buildSubtotal)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Load saved build ${build.name}`}
                    onPress={() => loadBuild(build)}
                    className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-lg bg-primary"
                  >
                    <Ionicons name="folder-open-outline" size={16} color="#fff" />
                    <Text className="text-primary-foreground text-xs font-bold">Load build</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <PartsAddedSheet
        visible={partsAddedSummary !== null}
        itemCount={partsAddedSummary?.count ?? 0}
        subtotal={partsAddedSummary?.subtotal ?? 0}
        onKeepBuilding={() => setPartsAddedSummary(null)}
        onViewCart={() => {
          setPartsAddedSummary(null);
          router.push("/cart");
        }}
      />
      <ConfirmClearModal
        visible={isClearConfirmOpen}
        title="Clear this build?"
        description={`This will remove all ${selectedProducts.length} selected ${selectedProducts.length === 1 ? "part" : "parts"} from your current build.`}
        detail="Saved builds on this device will not be affected."
        confirmLabel="Clear build"
        onCancel={() => setIsClearConfirmOpen(false)}
        onConfirm={() => {
          setSelection({});
          setIsClearConfirmOpen(false);
        }}
      />
      <ConfirmClearModal
        visible={buildToDelete !== null}
        title="Delete saved build?"
        description={buildToDelete ? `Delete ${buildToDelete.name} from your saved builds?` : "Delete this saved build?"}
        detail="This only removes the saved build from this device."
        confirmLabel="Delete build"
        onCancel={() => setBuildToDelete(null)}
        onConfirm={() => {
          if (buildToDelete) void deleteSavedBuild(buildToDelete);
        }}
      />
    </SafeAreaView>
  );
}

function PartsAddedSheet({ visible, itemCount, subtotal, onKeepBuilding, onViewCart }: { visible: boolean; itemCount: number; subtotal: number; onKeepBuilding: () => void; onViewCart: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onKeepBuilding}>
      <View className="flex-1 justify-end bg-black/55">
        <Pressable accessibilityLabel="Dismiss parts added confirmation" onPress={onKeepBuilding} className="absolute inset-0" />
        <View
          accessibilityViewIsModal
          className="w-full max-w-[560px] self-center rounded-t-2xl border-t border-border bg-background px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-muted-foreground/40" />
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <Ionicons name="checkmark-circle" size={27} color="#16a34a" />
          </View>
          <Text className="text-foreground text-lg font-bold">Parts added to cart</Text>
          <Text className="mt-2 text-muted-foreground text-sm leading-5">
            {itemCount} selected {itemCount === 1 ? "part is" : "parts are"} now in your cart. Your build is still here if you want to keep editing.
          </Text>
          <View className="mt-4 flex-row items-center justify-between rounded-lg border border-border bg-card px-3 py-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="hardware-chip-outline" size={17} color="#16a34a" />
              <Text className="text-muted-foreground text-xs">Parts added</Text>
            </View>
            <Text className="text-foreground text-xs font-semibold">{itemCount}</Text>
          </View>
          <View className="mt-2 flex-row items-center justify-between rounded-lg border border-border bg-card px-3 py-3">
            <Text className="text-muted-foreground text-xs">Parts subtotal</Text>
            <Text className="text-foreground text-sm font-bold">{formatPrice(subtotal)}</Text>
          </View>
          <View className="mt-5 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onKeepBuilding}
              className="h-12 flex-1 items-center justify-center rounded-lg border border-border bg-secondary"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Text className="text-foreground text-sm font-semibold">Keep building</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onViewCart}
              className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Ionicons name="cart-outline" size={17} color="#fff" />
              <Text className="text-primary-foreground text-sm font-bold">View cart</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BuilderSlotCard({ slot, product, isDark, onSelect, onRemove }: { slot: BuilderSlot; product?: Product; isDark: boolean; onSelect: () => void; onRemove: () => void }) {
  return (
    <View className={`flex-row items-center gap-3 rounded-xl border p-3 ${product ? "border-primary/50 bg-card" : "border-border bg-card"}`}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: Boolean(product) }} accessibilityLabel={`${product ? "Replace" : "Select"} ${slot.label}`} onPress={onSelect} className="min-h-[52px] flex-1 flex-row items-center gap-3">
        <View className={`h-10 w-10 items-center justify-center rounded-lg ${product ? "bg-primary/10" : "bg-secondary"}`}>
          <Ionicons name={product ? "checkmark" : "add"} size={21} color={product ? "#ef1b1b" : isDark ? "#cbd5e1" : "#59616d"} />
        </View>
        <View className="flex-1">
          <Text className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.1em]">{slot.label}{slot.required ? "" : " (Optional)"}</Text>
          <Text numberOfLines={2} className={`mt-1 text-sm ${product ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{product?.name ?? "Select a part"}</Text>
          {product && <Text className="mt-1 text-primary text-xs font-bold">{formatPrice(product.price)}</Text>}
        </View>
      </Pressable>
      {product ? (
        <Pressable accessibilityLabel={`Remove ${slot.label}`} onPress={onRemove} className="h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Ionicons name="close" size={18} color={isDark ? "#cbd5e1" : "#59616d"} />
        </Pressable>
      ) : (
        <Pressable accessibilityLabel={`Browse ${slot.label}`} onPress={onSelect} className="h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Ionicons name="chevron-forward" size={17} color={isDark ? "#cbd5e1" : "#59616d"} />
        </Pressable>
      )}
    </View>
  );
}

function PartOption({ product, brandName, selected, isDark, onPress }: { product: Product; brandName: string; selected: boolean; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} className={`flex-row items-center gap-3 rounded-xl border p-3 ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
      <ProductImage source={getProductImageSource(product.image)} className="h-14 w-14 rounded-lg bg-secondary" resizeMode="cover" />
      <View className="flex-1">
        <Text numberOfLines={2} className="text-foreground text-xs font-semibold">{product.name}</Text>
        <Text className="mt-1 text-muted-foreground text-[10px]">{brandName}</Text>
        <Text className="mt-1 text-primary text-sm font-bold">{formatPrice(product.price)}</Text>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "add-circle-outline"} size={22} color={selected ? "#ef1b1b" : isDark ? "#9ca3af" : "#68717e"} />
    </Pressable>
  );
}

function ActionButton({ icon, label, onPress, disabled }: { icon: "folder-open-outline" | "save-outline"; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} className="h-9 flex-row items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 disabled:opacity-40">
      <Ionicons name={icon} size={15} color="#ef1b1b" />
      <Text className="text-foreground text-[11px] font-semibold">{label}</Text>
    </Pressable>
  );
}

function SummaryMetric({ icon, label, value }: { icon: "flash-outline" | "git-branch-outline"; label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg bg-secondary p-3">
      <View className="flex-row items-center gap-1.5"><Ionicons name={icon} size={14} color="#ef1b1b" /><Text className="text-muted-foreground text-[10px]">{label}</Text></View>
      <Text className="mt-1.5 text-foreground text-xs font-bold">{value}</Text>
    </View>
  );
}
