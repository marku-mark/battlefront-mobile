export type BuildComponent = { key: string; product_id: number; quantity: number; configuration: Record<string, string>; component_type?: string };
export type BuilderProduct = { id: number; component_type: string; name: string; brand: string | null; image_url: string | null; price: string; stock_quantity: number | null; specifications: Record<string, unknown>; specifications_reviewed: boolean; is_wishlisted: boolean };
export type BuildValidation = { ruleset_version: number; status: string; complete: boolean; required_components: string[]; estimated_power_w: number | null; findings: { rule: string; status: string; component_keys: string[]; message: string }[] };
export type SavedBuild = { uuid: string; name: string; mode: "simple" | "advanced"; budget: string | null; edit_version: number; share_enabled: boolean; items: (BuildComponent & { name: string | null; price: string | null })[] };
export type BuildInput = { name: string; mode: "simple" | "advanced"; budget: string | null; components: BuildComponent[]; edit_version?: number };
export type BuilderCatalog = { components: Record<string, BuilderProduct[]>; templates: { uuid: string; name: string; description: string | null; budget: string | null; components: BuildComponent[] }[]; ruleset_version: number };
type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
export function createPcBuilderApi(request: Request) {
  async function data<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    return (await request<{ data: T }>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).data;
  }
  const path = (uuid: string) => `pc-builds/${encodeURIComponent(uuid)}`;
  return {
    catalog: () => data<BuilderCatalog>("pc-builder"),
    validate: (components: BuildComponent[]) => data<BuildValidation>("pc-builder/validate", "POST", { components }),
    list: () => data<SavedBuild[]>("pc-builds"),
    save: (input: BuildInput, uuid?: string) => data<SavedBuild>(uuid ? path(uuid) : "pc-builds", uuid ? "PATCH" : "POST", input),
    duplicate: (uuid: string) => data<SavedBuild>(`${path(uuid)}/duplicate`, "POST"),
    remove: (uuid: string) => data<{ deleted: boolean }>(path(uuid), "DELETE"),
    share: (uuid: string) => data<{ url: string }>(`${path(uuid)}/share`, "POST"),
    stopSharing: (uuid: string) => data<{ shared: boolean }>(`${path(uuid)}/share`, "DELETE"),
    shared: (token: string) => data<SavedBuild>(`pc-builds/shared/${encodeURIComponent(token)}`),
    addToCart: (uuid: string) => data<{ group_uuid: string; name: string; item_count: number }>(`${path(uuid)}/cart`, "POST"),
  };
}

export const COMPONENT_LABELS: Record<string, string> = { processor: "Processor", motherboard: "Motherboard", memory: "Memory", storage: "Storage", power_supply: "Power supply", case: "Case", graphics_card: "Graphics card", cooler: "CPU cooler", fan: "Case fan", network_adapter: "Network adapter", monitor: "Monitor", keyboard: "Keyboard", mouse: "Mouse", headset: "Headset", speakers: "Speakers", webcam: "Webcam", ups_avr: "UPS / AVR" };
export const SIMPLE_TYPES = ["processor", "motherboard", "memory", "storage", "power_supply", "case", "graphics_card", "cooler", "fan"];
const LEGACY_TYPES: Record<string, string> = { cpu: "processor", motherboard: "motherboard", memory: "memory", graphics: "graphics_card", storage: "storage", power: "power_supply", case: "case", cooling: "cooler" };
export type LocalBuild = { id: string; name: string; savedAt: string; selections: Record<string, string> };
export function readLegacyBuilds(raw: string | null): LocalBuild[] {
  try {
    const rows: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(rows) ? rows.filter((row): row is LocalBuild => row && typeof row.id === "string" && typeof row.name === "string" && row.selections && typeof row.selections === "object" && !Array.isArray(row.selections) && Object.values(row.selections).every((id) => typeof id === "string")) : [];
  } catch { return []; }
}
export function migrateLocalBuild(build: LocalBuild, catalog: BuilderCatalog) {
  const products = new Map(Object.values(catalog.components).flat().map((product) => [product.id, product]));
  const missing: string[] = [];
  const components: BuildComponent[] = [];
  for (const [slot, id] of Object.entries(build.selections)) {
    const product = products.get(Number(id));
    if (!product || product.component_type !== LEGACY_TYPES[slot] || (product.stock_quantity ?? 0) <= 0) { missing.push(COMPONENT_LABELS[LEGACY_TYPES[slot]] ?? slot); continue; }
    components.push({ key: `${product.component_type}-${product.id}`, product_id: product.id, component_type: product.component_type, quantity: 1, configuration: {} });
  }
  return { input: { name: build.name, mode: "simple", budget: null, components } satisfies BuildInput, missing };
}
export function buildSubtotal(components: BuildComponent[], products: BuilderProduct[]): number {
  const prices = new Map(products.map((product) => [product.id, Math.round(Number(product.price) * 100)]));
  return components.reduce((sum, item) => sum + (prices.get(item.product_id) ?? 0) * item.quantity, 0) / 100;
}
