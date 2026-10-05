import { createReadCache, loadSelectedProducts } from "./readCache";
import type { ApiUser, ProfileInput } from "./accountApi";
import { banners, type Banner, type Brand, type Category, type Product, type Store } from "./data";
import { ApiError, createApiClient, createCachedRead, createPacedRead, type Page } from "./apiClient";
import { createProgressiveCatalog } from "./catalogCache";
import { createAccountApi } from "./accountApi";
import { mapProduct, type ApiProduct } from "./productCatalog";
export { mapProduct, type ApiProduct } from "./productCatalog";
export type { ApiUser, AuthResult, ProfileInput, RegistrationInput } from "./accountApi";
import type { ApiCart } from "./cartState";
export type { ApiCart } from "./cartState";
export { ApiError } from "./apiClient";
let sessionRevision = 0;
export function getSessionRevision() { return sessionRevision; }
let accessToken: string | null = null;
let localUserId: number | null = null;
let chatContext: string | null = null;
let chatGeneration = 0;
const sessionChangeListeners = new Set<() => void>();
export function onSessionChange(listener: () => void) { sessionChangeListeners.add(listener); return () => { sessionChangeListeners.delete(listener); }; }
const sessionListeners = new Set<() => void>();
export function setAccessToken(token: string | null, userId: number | null = null) { if (accessToken !== token || localUserId !== userId) { sessionRevision++; profileCache.clear(); sessionChangeListeners.forEach((listener) => listener()); } accessToken = token; localUserId = userId; resetChatContext(); }
export function getLocalUserId() { return localUserId ?? "guest"; }
export function onSessionExpired(listener: () => void) { sessionListeners.add(listener); return () => { sessionListeners.delete(listener); }; }
export function resetChatContext() { chatContext = null; chatGeneration++; }
export const apiRequest = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? "", () => accessToken, () => {
  setAccessToken(null);
  sessionListeners.forEach((listener) => listener());
});
type Envelope<T> = { data: T };
const account = createAccountApi(apiRequest);
const profileCache = createReadCache<ApiUser>(30_000, Date.now, 1);
export const { login, register, logout } = account;
export function getProfile() { return profileCache.read("profile", account.getProfile); }
export async function updateProfile(fields: ProfileInput) {
  const owner = sessionRevision;
  const user = await account.updateProfile(fields);
  if (owner === sessionRevision) { profileCache.clear(); profileCache.seed("profile", user); }
  return user;
}
type Filters = { categories: { id: number; name: string }[]; brands: string[] };
const readCatalog = createPacedRead(apiRequest);
const filterCache = createCachedRead(() => readCatalog<Envelope<Filters>>("products/filters").then((result) => result.data), 60_000);
function getFilters() { return filterCache.read(); }
export async function getCategories(): Promise<Category[]> { return (await getFilters()).categories.map((row) => ({ id: String(row.id), name: row.name, icon: "cube-outline" })); }
export async function getBrands(): Promise<Brand[]> { return (await getFilters()).brands.map((name) => ({ id: name, name, logo: "" })); }
const productCache = createReadCache<Product | null>(60_000);
const searchCache = createReadCache<Product[]>(30_000, Date.now, 20);
let productRevision = 0;
const catalogCache = createProgressiveCatalog(async (page) => {
  const revision = productRevision;
  const result = await readCatalog<Page<ApiProduct>>(`products?page=${page}`);
  const products = result.data.map(mapProduct);
  if (revision === productRevision) products.forEach((product) => productCache.seed(product.id, product));
  return { ...result, data: products };
});
export function invalidateCatalog() { productRevision++; catalogCache.invalidate(); filterCache.invalidate(); productCache.clear(); searchCache.clear(); }
export function getProducts(): Promise<Product[]> { return catalogCache.all(); }
export const getCatalogPreview = catalogCache.first;
export const getCatalogSnapshot = catalogCache.snapshot;
export const subscribeCatalog = catalogCache.subscribe;
export function getProductSnapshot(id: string) {
  const cached = productCache.peek(id);
  return cached === undefined ? catalogCache.snapshot().rows.find((product) => product.id === id) : cached;
}
export function getProductById(id: string): Promise<Product | null> {
  return productCache.read(id, async () => {
    try { return mapProduct((await apiRequest<Envelope<ApiProduct>>("products/" + encodeURIComponent(id))).data); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  });
}
export function getSelectedProducts(ids: string[]) { return loadSelectedProducts(ids, getProductById); }
export function searchProducts(query: string): Promise<Product[]> {
  const term = query.trim();
  if (term.length < 2) return Promise.resolve([]);
  return searchCache.read(term, async () => {
    const revision = productRevision;
    const result = await apiRequest<Page<ApiProduct>>("products?q=" + encodeURIComponent(term));
    const products = result.data.map(mapProduct);
    if (revision === productRevision) products.forEach((product) => productCache.seed(product.id, product));
    return products;
  });
}
export function prefetchProductById(id: string): void { void getProductById(id).catch(() => undefined); }
export type HomeCatalog = { catalogProducts: Product[]; flashDeals: Product[]; sulitPicks: Product[]; newArrivals: Product[] };
export async function getHomeCatalog(): Promise<HomeCatalog> {
  const catalogProducts = await getCatalogPreview();
  return homeCatalogFromProducts(catalogProducts);
}
export function homeCatalogFromProducts(catalogProducts: Product[]): HomeCatalog {
  return { catalogProducts, flashDeals: catalogProducts.filter((row) => row.originalPrice !== undefined).slice(0, 12), sulitPicks: [...catalogProducts].sort((a, b) => a.price - b.price).slice(0, 12), newArrivals: [] };
}
export async function getBanners(): Promise<Banner[]> { return banners; }
export async function getFlashDeals() { return (await getHomeCatalog()).flashDeals; }
export async function getSulitPicks() { return (await getHomeCatalog()).sulitPicks; }
export async function getNewArrivals() { return (await getHomeCatalog()).newArrivals; }
export function getFlashDealEndTime() { return new Date(); }
export async function getChatbotReply(message: string): Promise<string> {
  const generation = chatGeneration;
  const result = (await apiRequest<Envelope<{ message: string; context_token: string | null }>>("chatbot", { method: "POST", body: JSON.stringify({ message, context_token: chatContext }) })).data;
  if (generation === chatGeneration) chatContext = result.context_token;
  return result.message;
}
export async function getBranches(): Promise<Store[]> {
  const result = await apiRequest<Envelope<{ id: number; name: string; city: string; address: string | null; contact_number: string | null; operating_hours: string; latitude: number | null; longitude: number | null }[]>>("branches");
  return result.data.map((row) => ({ id: String(row.id), name: row.name, city: row.city, branch: `${row.city} Branch`, address: row.address ?? "Address not confirmed", phone: row.contact_number ?? "", hours: row.operating_hours, latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined }));
}
export async function getCart() { return (await apiRequest<Envelope<ApiCart>>("cart")).data; }
export async function addCartItem(productId: string, quantity: number) { return (await apiRequest<Envelope<ApiCart>>("cart/items", { method: "POST", body: JSON.stringify({ product_id: Number(productId), quantity }) })).data; }
export async function changeCartItem(id: number, quantity: number) { return (await apiRequest<Envelope<ApiCart>>(`cart/items/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) })).data; }
export async function deleteCartItem(id: number) { return (await apiRequest<Envelope<ApiCart>>(`cart/items/${id}`, { method: "DELETE" })).data; }
export type Checkout = { cart: { items: { id: number; quantity: number; product: { id: number; name: string; brand: string | null; image_url: string | null }; unit_price: string; line_total: string }[]; item_count: number; total_quantity: number; total: string }; pickup_location: { name: string; address: string; contact_number: string | null; operating_hours: string }; customer: { name: string; default_delivery_address: string | null }; fulfillment_methods: { value: string; label: string }[]; payment_methods: { value: string; label: string; requires_proof: boolean; available_for: string[]; payment_account: { account_name: string; account_number: string; is_demo: boolean } | null }[] };
export async function getCheckout() { return (await apiRequest<Envelope<Checkout>>("checkout")).data; }
export type RecommendationOptions = { intended_uses: { value: string; label: string }[]; filter_options: Filters };
export type Recommendation = { product: ApiProduct; effective_price: string; reasons: string[] };
export async function getRecommendationOptions() { return (await apiRequest<Envelope<RecommendationOptions>>("recommendations/options")).data; }
export async function getRecommendations(criteria: { budget: string; intended_use: string; category_id?: number; preferred_brand?: string; tag_ids?: number[] }) {
  return (await apiRequest<Envelope<Recommendation[]>>("recommendations", { method: "POST", body: JSON.stringify(criteria) })).data;
}
