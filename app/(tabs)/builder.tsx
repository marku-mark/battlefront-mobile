import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { useSession } from "@/hooks/useSession";
import { useCartActions } from "@/hooks/useCart";
import { useToast } from "@/hooks/useToast";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ProductImage } from "@/components/products/ProductImage";
import { getSessionRevision, getLocalUserId } from "@/lib/api";
import { pcBuilder } from "@/lib/pcBuilder";
import { buildSubtotal, COMPONENT_LABELS, SIMPLE_TYPES, migrateLocalBuild, readLegacyBuilds, type BuildComponent, type BuildInput, type BuildValidation, type BuilderCatalog, type BuilderProduct, type LocalBuild, type SavedBuild } from "@/lib/pcBuilderApi";

const money = (value: number) => `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MULTIPLE_TYPES = ["memory", "storage", "fan", "monitor"];
function Action({ title, onPress, disabled = false, primary = false }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} className={`min-h-12 justify-center rounded-lg px-4 py-3 ${primary ? "bg-primary" : "border border-border bg-secondary"}`} style={{ opacity: disabled ? 0.45 : 1 }}><Text className={primary ? "text-primary-foreground font-semibold" : "text-foreground font-semibold"}>{title}</Text></Pressable>;
}

export default function BuilderScreen() {
  const router = useRouter();
  const { shared } = useLocalSearchParams<{ shared?: string }>();
  const { session } = useSession();
  const owner = session.mode === "customer" ? session.user.id : "guest";
  const { refreshCart } = useCartActions();
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState<BuilderCatalog | null>(null);
  const [saved, setSaved] = useState<SavedBuild[]>([]);
  const [legacy, setLegacy] = useState<LocalBuild[]>([]);
  const [components, setComponents] = useState<BuildComponent[]>([]);
  const [name, setName] = useState("My PC build");
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [budget, setBudget] = useState("");
  const [editing, setEditing] = useState<SavedBuild | null>(null);
  const [validation, setValidation] = useState<BuildValidation | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState<"name" | "price_asc" | "price_desc">("name");
  const [shareInput, setShareInput] = useState("");
  const [hydratedOwner, setHydratedOwner] = useState<string | number | null>(null);
  const pending = useRef(false);
  const scrollView = useRef<ScrollView>(null);
  const summaryOffset = useRef(0);
  const processedShare = useRef("");
  const guestContinuation = useRef<BuildInput | null>(null);
  const selectionRevision = useRef(0);
  const products = useMemo(() => Object.values(catalog?.components ?? {}).flat(), [catalog]);
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const subtotal = buildSubtotal(components, products);
  const storageKey = `battlefront-builder-draft:${owner}`;

  function loadDraft(input: BuildInput, build: SavedBuild | null = null) {
    setComponents(input.components.map((item) => ({ ...item, configuration: { ...item.configuration } })));
    setName(input.name); setMode(input.mode); setBudget(input.budget ?? ""); setEditing(build); setValidation(null); setError("");
  }
  async function reloadSaved() {
    const revision = getSessionRevision(); const rows = await pcBuilder.list();
    if (revision === getSessionRevision()) setSaved(rows);
  }
  useEffect(() => {
    let active = true;
    setHydratedOwner(null); setCatalog(null); setSaved([]); setEditing(null); setValidation(null); setError(""); setActiveType(null);
    setComponents([]); setName("My PC build"); setMode("simple"); setBudget(""); processedShare.current = "";
    void (async () => {
      const [raw, old] = await Promise.all([AsyncStorage.getItem(storageKey), AsyncStorage.getItem("battlefront-api-saved-builds")]);
      if (!active) return;
      setLegacy(readLegacyBuilds(old));
      try {
        const draft = owner !== "guest" && guestContinuation.current ? guestContinuation.current : JSON.parse(raw ?? "null");
        if (owner !== "guest") guestContinuation.current = null;
        if (draft && Array.isArray(draft.components) && draft.components.length <= 32 && draft.components.every((item: BuildComponent) => item && typeof item.key === "string" && Number.isInteger(item.product_id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99 && item.configuration && typeof item.configuration === "object")) {
          loadDraft({ name: typeof draft.name === "string" ? draft.name : "My PC build", mode: draft.mode === "advanced" ? "advanced" : "simple", budget: typeof draft.budget === "string" ? draft.budget : null, components: draft.components });
        }
      } catch { /* Invalid local data must not block the live builder. */ }
    })().catch(() => { if (active) setError("Could not restore the local draft."); }).finally(() => { if (active) setHydratedOwner(owner); });
    return () => { active = false; };
  }, [owner, storageKey]);
  useEffect(() => {
    if (hydratedOwner !== owner) return;
    const timer = setTimeout(() => { void AsyncStorage.setItem(storageKey, JSON.stringify({ name, mode, budget, components })).catch(() => undefined); }, 400);
    return () => clearTimeout(timer);
  }, [storageKey, hydratedOwner, owner, name, mode, budget, components]);
  useActiveFocusEffect(useCallback(() => {
    let active = true; const revision = getSessionRevision();
    void pcBuilder.catalog().then((data) => { if (active && revision === getSessionRevision()) { setCatalog(data); setError(""); } }).catch((reason) => { if (active && revision === getSessionRevision()) setError(reason.message); });
    if (owner !== "guest") void pcBuilder.list().then((rows) => { if (active && revision === getSessionRevision()) setSaved(rows); }).catch((reason) => { if (active && revision === getSessionRevision()) setError(reason.message); });
    return () => { active = false; };
  }, [owner]));
  useEffect(() => {
    const revision = ++selectionRevision.current; const sessionRevision = getSessionRevision();
    setValidation(null);
    if (!catalog || hydratedOwner !== owner || components.length === 0) { setChecking(false); return; }
    setChecking(true);
    const timer = setTimeout(() => {
      void pcBuilder.validate(components).then((result) => { if (revision === selectionRevision.current && sessionRevision === getSessionRevision()) setValidation(result); })
        .catch((reason) => { if (revision === selectionRevision.current && sessionRevision === getSessionRevision()) setError(reason.message); })
        .finally(() => { if (revision === selectionRevision.current) setChecking(false); });
    }, 900);
    return () => { clearTimeout(timer); selectionRevision.current++; };
  }, [components, catalog, hydratedOwner, owner]);
  useEffect(() => {
    if (!shared || !catalog || hydratedOwner !== owner || processedShare.current === shared) return;
    const revision = getSessionRevision(); processedShare.current = shared;
    void pcBuilder.shared(shared).then((build) => { if (revision === getSessionRevision()) loadDraft({ name: `${build.name} (copy)`.slice(0, 120), mode: build.mode, budget: build.budget, components: build.items }); })
      .catch((reason) => { if (revision === getSessionRevision()) setError(reason.message); });
  }, [shared, catalog, hydratedOwner, owner]);
  async function run(task: (current: () => void) => Promise<void>) {
    if (pending.current) return;
    const revision = getSessionRevision();
    const current = () => { if (revision !== getSessionRevision()) throw new Error("Your account changed. Reopen the builder."); };
    pending.current = true; setBusy(true); setError("");
    try { await task(current); }
    catch (reason) { if (revision === getSessionRevision()) setError(reason instanceof Error ? reason.message : "Could not complete this action. Check your saved builds and cart before retrying."); }
    finally { pending.current = false; setBusy(false); }
  }
  function input(): BuildInput {
    if (!name.trim() || name.trim().length > 120) throw new Error("Enter a build name of up to 120 characters.");
    if (budget && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) throw new Error("Enter a valid budget.");
    return { name: name.trim(), mode, budget: budget || null, components, ...(editing ? { edit_version: editing.edit_version } : {}) };
  }
  function saveBuild(addToCart = false) {
    if (owner === "guest") { guestContinuation.current = { name, mode, budget: budget || null, components }; setSignIn(true); return; }
    void run(async (current) => {
      const build = await pcBuilder.save(input(), editing?.uuid); current(); setEditing(build);
      await reloadSaved(); current();
      if (addToCart) {
        await pcBuilder.addToCart(build.uuid); current(); await refreshCart(true); current();
        showToast("Complete build added to your cart."); router.push("/(tabs)/cart");
      } else showToast("Build saved to your account.");
    });
  }
  function choose(product: BuilderProduct) {
    if (busy || (product.stock_quantity ?? 0) <= 0) return;
    setComponents((rows) => {
      if (rows.some((row) => row.product_id === product.id)) return rows;
      const kept = MULTIPLE_TYPES.includes(product.component_type) ? rows : rows.filter((row) => (byId.get(row.product_id)?.component_type ?? row.component_type) !== product.component_type);
      if (kept.length >= 32) return rows;
      return [...kept, { key: `${product.component_type}-${product.id}`, product_id: product.id, component_type: product.component_type, quantity: 1, configuration: {} }];
    }); setActiveType(null);
  }
  const availableProducts = useMemo(() => (catalog?.components[activeType ?? ""] ?? []).filter((product) => (!brand || product.brand === brand) && `${product.name} ${product.brand ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "price_asc" ? Number(a.price) - Number(b.price) : Number(b.price) - Number(a.price)), [catalog, activeType, brand, query, sort]);
  const fanPositions = byId.get(components.find((item) => byId.get(item.product_id)?.component_type === "case")?.product_id ?? 0)?.specifications.fan_mounting_positions;
  return <SafeAreaView edges={["left", "right", "bottom"]} className="flex-1 bg-background">
    <ScreenHeader title="PC Builder" />
    <ScrollView ref={scrollView} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 900, width: "100%", alignSelf: "center" }}>
      <Text className="text-foreground text-2xl font-bold">Build your PC</Text>
      <Text className="mt-2 text-muted-foreground">Choose catalog parts and review compatibility based on verified hardware specifications.</Text>
      {error ? <View className="mt-4 gap-2"><Text accessibilityRole="alert" className="text-danger">{error}</Text><Action title="Refresh catalog and saved builds" disabled={busy} onPress={() => void run(async (current) => { const data = await pcBuilder.catalog(); current(); setCatalog(data); if (owner !== "guest") await reloadSaved(); })} /></View> : null}
      {!catalog || hydratedOwner !== owner ? <ActivityIndicator accessibilityLabel="Loading PC builder" className="my-6" /> : <>
        <View className="mt-5 flex-row gap-2">{(["simple", "advanced"] as const).map((value) => <Action key={value} title={value === "simple" ? "Simple" : "Advanced"} primary={mode === value} disabled={busy} onPress={() => setMode(value)} />)}</View>
        <Text className="mt-4 text-foreground font-semibold">Build name</Text><TextInput accessibilityLabel="Build name" value={name} onChangeText={setName} editable={!busy} maxLength={120} className="mt-2 min-h-12 rounded-lg border border-border px-3 text-foreground" />
        <Text className="mt-4 text-foreground font-semibold">Budget (PHP, optional)</Text><TextInput accessibilityLabel="Build budget" value={budget} onChangeText={setBudget} editable={!busy} keyboardType="decimal-pad" placeholder="Enter a budget" className="mt-2 min-h-12 rounded-lg border border-border px-3 text-foreground" />
        <View className="mt-6">
          <Text className="text-foreground text-lg font-bold">Choose your components</Text>
          <Text className="mt-1 mb-3 text-muted-foreground">Start with a processor, then build around it.</Text>
          {(mode === "simple" ? SIMPLE_TYPES : Object.keys(COMPONENT_LABELS)).map((type, index) => {
            const selected = components.filter((item) => (byId.get(item.product_id)?.component_type ?? item.component_type) === type);
            const first = selected.length ? byId.get(selected[0].product_id) : null;
            return <Pressable key={type} accessibilityRole="button" accessibilityLabel={`${selected.length ? "Change" : "Choose"} ${COMPONENT_LABELS[type]}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { setQuery(""); setBrand(""); setActiveType(type); }} className="flex-row items-center gap-3 border-b border-border py-4" style={{ opacity: busy ? 0.45 : 1 }}>
              <View className="h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                {first?.image_url ? <ProductImage source={{ uri: first.image_url }} style={{ width: 40, height: 40 }} resizeMode="contain" /> : <Text className="text-muted-foreground font-bold">{String(index + 1).padStart(2, "0")}</Text>}
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">{COMPONENT_LABELS[type]}</Text>
                <Text numberOfLines={2} className="mt-1 text-sm text-muted-foreground">{selected.length ? first?.name ?? "Unavailable selection — replace part" : "No part selected"}</Text>
                {selected.length > 1 && <Text className="mt-1 text-xs text-muted-foreground">+{selected.length - 1} more selections</Text>}
              </View>
              <Text className="text-primary font-semibold">{selected.length ? "Edit" : "+ Add"}</Text>
            </Pressable>;
          })}
        </View>
        {components.length > 0 && <Text className="mt-6 text-lg font-bold text-foreground">Your selected parts</Text>}
        <View className="mt-6 gap-4">{components.map((item) => { const product = byId.get(item.product_id); const type = product?.component_type ?? item.component_type; return <View key={item.key} className="border-b border-border pb-4">
          <Text className="text-foreground font-semibold">{product?.name ?? `Unavailable component #${item.product_id}`}</Text><Text className="mt-1 text-muted-foreground">{product ? money(Number(product.price) * item.quantity) : "Replace this selection"} · Qty {item.quantity}</Text>
          {product && !product.specifications_reviewed && <Text className="text-muted-foreground">Specifications await review. Compatibility may be unknown.</Text>}
          <View className="mt-2 flex-row flex-wrap gap-2"><Action title="−" disabled={busy || item.quantity <= 1} onPress={() => setComponents((rows) => rows.map((row) => row.key === item.key ? { ...row, quantity: row.quantity - 1 } : row))} /><Action title="+" disabled={busy || item.quantity >= Math.min(99, product?.stock_quantity ?? 0)} onPress={() => setComponents((rows) => rows.map((row) => row.key === item.key ? { ...row, quantity: row.quantity + 1 } : row))} /><Action title="Remove" disabled={busy} onPress={() => setComponents((rows) => rows.filter((row) => row.key !== item.key))} /></View>
          {type === "fan" && Array.isArray(fanPositions) && <View className="mt-2 gap-2"><Text className="text-foreground">Case mounting position</Text>{fanPositions.map((position: unknown) => typeof position === "string" ? <Action key={position} title={position} primary={item.configuration.mounting_position === position} disabled={busy} onPress={() => setComponents((rows) => rows.map((row) => row.key === item.key ? { ...row, configuration: { ...row.configuration, mounting_position: position } } : row))} /> : null)}</View>}
        </View>; })}</View>
        <View onLayout={(event) => { summaryOffset.current = event.nativeEvent.layout.y; }} className="mt-6 border-t border-border pt-5">
          <Text className="text-muted-foreground text-sm">Build subtotal</Text>
          <Text className="mt-1 text-foreground text-3xl font-bold">{money(subtotal)}</Text>
          {budget && Number(budget) > 0 ? <Text className={`mt-2 ${subtotal > Number(budget) ? "text-danger" : "text-muted-foreground"}`}>{subtotal > Number(budget) ? `Over budget by ${money(subtotal - Number(budget))}` : `${money(Number(budget) - subtotal)} remaining in budget`}</Text> : null}
        </View>
        <Text className="mt-2 text-muted-foreground">Current catalog prices. Stock, price, and compatibility are checked again when adding to cart.</Text>
        <Text accessibilityLiveRegion="polite" className="mt-5 text-foreground font-bold">{checking ? "Checking compatibility…" : validation ? `Compatibility: ${validation.status}` : "Select components to check compatibility"}</Text>
        {validation?.required_components.length ? <Text className="mt-2 text-muted-foreground">Required: {validation.required_components.map((type) => COMPONENT_LABELS[type] ?? type).join(", ")}</Text> : null}
        {validation && <Text className="mt-2 text-muted-foreground">Estimated power: {validation.estimated_power_w === null ? "Unknown" : `${validation.estimated_power_w} W`} · Ruleset {validation.ruleset_version}</Text>}
        {validation?.findings.map((finding, index) => <Text key={`${finding.rule}-${index}`} className={`mt-2 ${finding.status === "incompatible" ? "text-danger" : "text-muted-foreground"}`}>{finding.status}: {finding.message}</Text>)}
        <View className="mt-5 gap-2"><Action title={editing ? "Save changes" : owner === "guest" ? "Sign in to save build" : "Save build"} primary disabled={busy || components.length === 0 || hydratedOwner !== owner} onPress={() => saveBuild()} /><Action title="Save and add complete build to cart" disabled={busy || checking || !validation?.complete} onPress={() => saveBuild(true)} /><Action title="New build" disabled={busy} onPress={() => Alert.alert("Start a new build?", "Your current draft will be replaced. Account builds remain saved.", [{ text: "Keep draft", style: "cancel" }, { text: "New build", onPress: () => loadDraft({ name: "My PC build", mode: "simple", budget: null, components: [] }) }])} /></View>
        <Text className="mt-8 text-foreground text-lg font-bold">Build templates</Text>{catalog.templates.length === 0 ? <Text className="mt-2 text-muted-foreground">No verified templates are currently available.</Text> : catalog.templates.map((template) => <View key={template.uuid} className="mt-3 gap-2"><Text className="text-foreground font-semibold">{template.name}</Text><Text className="text-muted-foreground">{template.description}</Text><Action title="Use template" disabled={busy} onPress={() => loadDraft({ name: template.name, mode: "simple", budget: template.budget, components: template.components })} /></View>)}
        <Text className="mt-8 text-foreground text-lg font-bold">Saved builds</Text>
        {owner === "guest" ? <Action title="Sign in to load your saved builds" onPress={() => setSignIn(true)} /> : saved.length === 0 ? <Text className="mt-2 text-muted-foreground">No builds saved to this account yet.</Text> : saved.map((build) => <View key={build.uuid} className="mt-4 border-b border-border pb-4 gap-2"><Text className="text-foreground font-semibold">{build.name}{editing?.uuid === build.uuid ? " · Editing" : ""}</Text><View className="flex-row flex-wrap gap-2">
          <Action title="Open" disabled={busy} onPress={() => loadDraft({ name: build.name, mode: build.mode, budget: build.budget, components: build.items }, build)} />
          <Action title="Duplicate" disabled={busy} onPress={() => void run(async (current) => { await pcBuilder.duplicate(build.uuid); current(); await reloadSaved(); })} />
          <Action title="Share" disabled={busy} onPress={() => void run(async (current) => { const result = await pcBuilder.share(build.uuid); current(); await reloadSaved(); current(); await Share.share({ message: `${build.name}\n${result.url}` }); })} />
          {build.share_enabled && <Action title="Stop sharing" disabled={busy} onPress={() => void run(async (current) => { await pcBuilder.stopSharing(build.uuid); current(); await reloadSaved(); })} />}
          <Action title="Delete" disabled={busy} onPress={() => Alert.alert("Delete saved build?", build.name, [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void run(async (current) => { await pcBuilder.remove(build.uuid); current(); if (editing?.uuid === build.uuid) setEditing(null); await reloadSaved(); }) }])} />
        </View></View>)}
        {legacy.length > 0 && <View className="mt-8 gap-3"><Text className="text-foreground text-lg font-bold">Previous local builds</Text><Text className="text-muted-foreground">Import a copy to this account. Original local builds stay on this device.</Text>{legacy.map((build) => <Action key={build.id} title={`Import ${build.name}`} disabled={busy} onPress={() => {
          if (owner === "guest") { setSignIn(true); return; }
          const result = migrateLocalBuild(build, catalog);
          Alert.alert("Import local build?", result.missing.length ? `Unavailable selections need replacing: ${result.missing.join(", ")}. The original stays unchanged.` : "Create an account copy of this local build?", [{ text: "Cancel", style: "cancel" }, { text: "Import copy", onPress: () => void run(async (current) => { const created = await pcBuilder.save(result.input); current(); loadDraft({ ...result.input, components: created.items }, created); await reloadSaved(); showToast("Local build copied to your account."); }) }]);
        }} />)}</View>}
        <Text className="mt-8 text-foreground text-lg font-bold">Open a shared build</Text><TextInput accessibilityLabel="Shared build link" value={shareInput} onChangeText={setShareInput} editable={!busy} autoCapitalize="none" placeholder="Paste a Battlefront build link" className="mt-2 min-h-12 rounded-lg border border-border px-3 text-foreground" />
        <View className="mt-2"><Action title="Open as a new draft" disabled={busy} onPress={() => {
          const token = shareInput.trim().split(/[/?#]/).filter(Boolean).find((part) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(part));
          if (!token) { setError("Paste a valid shared build link or token."); return; }
          void run(async (current) => { const build = await pcBuilder.shared(token); current(); loadDraft({ name: `${build.name} (copy)`.slice(0, 120), mode: build.mode, budget: build.budget, components: build.items }); });
        }} /></View>
      </>}{busy && <ActivityIndicator className="mt-4" accessibilityLabel="Updating build" />}
    </ScrollView>
    {catalog && hydratedOwner === owner && <View className="flex-row items-center justify-between gap-3 border-t border-border bg-background px-4 py-3">
      <View className="flex-1"><Text className="text-xs text-muted-foreground">Build subtotal · {components.reduce((sum, item) => sum + item.quantity, 0)} parts</Text><Text className="text-xl font-bold text-foreground">{money(subtotal)}</Text></View>
      <Action title="Review build" onPress={() => scrollView.current?.scrollTo({ y: summaryOffset.current, animated: true })} />
    </View>}
    <Modal visible={activeType !== null} animationType="slide" onRequestClose={() => setActiveType(null)}><SafeAreaView className="flex-1 bg-background"><View className="p-4 gap-3">
      <Action title="Back to build" onPress={() => setActiveType(null)} /><Text className="text-foreground text-xl font-bold">{COMPONENT_LABELS[activeType ?? ""]}</Text><TextInput accessibilityLabel="Search components" value={query} onChangeText={setQuery} placeholder="Search components" className="min-h-12 rounded-lg border border-border px-3 text-foreground" />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}><Action title="All brands" primary={!brand} onPress={() => setBrand("")} />{[...new Set((catalog?.components[activeType ?? ""] ?? []).map((product) => product.brand).filter((value): value is string => Boolean(value)))].sort().map((value) => <Action key={value} title={value} primary={brand === value} onPress={() => setBrand(value)} />)}</ScrollView>
      <View className="flex-row gap-2">{(["name", "price_asc", "price_desc"] as const).map((value) => <Action key={value} title={value === "name" ? "Name" : value === "price_asc" ? "Price ↑" : "Price ↓"} primary={sort === value} onPress={() => setSort(value)} />)}</View>
    </View><FlatList data={availableProducts} keyExtractor={(product) => String(product.id)} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text className="p-4 text-muted-foreground">No matching components.</Text>} contentContainerStyle={{ padding: 16 }} renderItem={({ item: product }) => <View className="mb-4 border-b border-border pb-4 gap-2">{product.image_url ? <ProductImage source={{ uri: product.image_url }} style={{ width: 96, height: 96 }} resizeMode="contain" /> : null}<Text className="text-foreground font-semibold">{product.name}</Text><Text className="text-primary">{money(Number(product.price))}</Text><Text className="text-muted-foreground">{(product.stock_quantity ?? 0) > 0 ? `${product.stock_quantity} in stock` : "Out of stock"} · {product.specifications_reviewed ? "Reviewed specifications" : "Specifications pending review"}</Text><Text className="text-muted-foreground text-xs">{Object.entries(product.specifications).slice(0, 6).map(([key, value]) => `${key.replace(/_/g, " ")}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`).join(" · ")}</Text><Action title={components.some((item) => item.product_id === product.id) ? "Selected" : "Select component"} primary disabled={busy || (product.stock_quantity ?? 0) <= 0 || components.some((item) => item.product_id === product.id)} onPress={() => choose(product)} /></View>} /></SafeAreaView></Modal>
    <MockSignInSheet visible={signIn} onClose={() => { if (getLocalUserId() === "guest") guestContinuation.current = null; setSignIn(false); }} />
  </SafeAreaView>;
}
