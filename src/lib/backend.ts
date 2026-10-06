import { fetch as expoFetch } from "expo/fetch";
import { createCategoryCachePool } from "./categoryQuery";
import { CACHE_AGE } from "./cachePolicy";
import { createCartApi } from "./cartApi";
import { loadProductSearchPage } from "./productCatalog";
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
export function setAccessToken(token: string | null, userId: number | null = null) {
  const changed = accessToken !== token || localUserId !== userId;
  accessToken = token; localUserId = userId;
  if (changed) { sessionRevision++; profileCache.clear(); cartCache.clear(); sessionChangeListeners.forEach((listener) => listener()); }
  resetChatContext();
}
export function getLocalUserId() { return localUserId ?? "guest"; }
export function onSessionExpired(listener: () => void) { sessionListeners.add(listener); return () => { sessionListeners.delete(listener); }; }
export function resetChatContext() { chatContext = null; chatGeneration++; }
export const apiRequest = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? "", () => accessToken, () => {
  setAccessToken(null);
  sessionListeners.forEach((listener) => listener());
}, Date.now, expoFetch);
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
const filterCache = createCachedRead(() => apiRequest<Envelope<Filters>>("products/filters").then((result) => result.data), CACHE_AGE.filters);
function getFilters() { return filterCache.read(); }
export async function getCategories(): Promise<Category[]> { return (await getFilters()).categories.map((row) => ({ id: String(row.id), name: row.name, icon: "cube-outline" })); }
export async function getBrands(): Promise<Brand[]> { return (await getFilters()).brands.map((name) => ({ id: name, name, logo: "" })); }
const productCache = createReadCache<Product | null>(CACHE_AGE.products);
const searchCache = createReadCache<Page<Product>>(CACHE_AGE.search, Date.now, 40);
let productRevision = 0;
const catalogCache = createProgressiveCatalog(async (page) => {
  const revision = productRevision;
  const result = await readCatalog<Page<ApiProduct>>(`products?page=${page}`);
  const products = result.data.map(mapProduct);
  if (revision === productRevision) products.forEach((product) => productCache.seed(product.id, product));
  return { ...result, data: products };
}, CACHE_AGE.products);
export const getCategoryCatalog = createCategoryCachePool((key: string) => ({
  pager: createProgressiveCatalog(async (page) => {
    const result = await apiRequest<Page<ApiProduct>>("products?" + key + "&page=" + page);
    return { ...result, data: result.data.map(mapProduct) };
  }, CACHE_AGE.products),
  scrollOffset: 0,
}));
export function invalidateCatalog(refreshFilters = false) {
  productRevision++; catalogCache.invalidate(); productCache.clear(); searchCache.clear();
  getCategoryCatalog.invalidate((entry) => entry.pager.invalidate());
  if (refreshFilters) filterCache.invalidate();
}
export function getProducts(shouldContinue?: () => boolean): Promise<Product[]> { return catalogCache.all(shouldContinue); }
export const getCatalogPreview = catalogCache.resume;
export const loadNextCatalogPage = catalogCache.next;
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
export function getSelectedProducts(ids: string[], shouldContinue?: () => boolean) { return loadSelectedProducts(ids, getProductById, 3, shouldContinue); }
export function searchProductPage(query: string, page = 1): Promise<Page<Product>> {
  const term = query.trim();
  if (term.length < 2) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } });
  return searchCache.read(JSON.stringify([term, page]), async () => {
    const revision = productRevision;
    const result = await loadProductSearchPage(apiRequest, term, page);
    const products = result.data;
    if (revision === productRevision) products.forEach((product) => productCache.seed(product.id, product));
    return { ...result, data: products };
  });
}
export async function searchProducts(query: string): Promise<Product[]> {
  return (await searchProductPage(query)).data;
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
export async function getChatbotReply(message: string): Promise<string> {
  const generation = chatGeneration;
  const result = (await apiRequest<Envelope<{ message: string; context_token: string | null }>>("chatbot", { method: "POST", body: JSON.stringify({ message, context_token: chatContext }) })).data;
  if (generation === chatGeneration) chatContext = result.context_token;
  return result.message;
}
const branchCache = createReadCache<Store[]>(CACHE_AGE.branches, Date.now, 1);
export function getBranches(force = false): Promise<Store[]> {
  return branchCache.read("branches", async () => {
    const result = await apiRequest<Envelope<{ id: number; name: string; city: string; address: string | null; contact_number: string | null; operating_hours: string; latitude: number | null; longitude: number | null }[]>>("branches");
    return result.data.map((row) => ({ id: String(row.id), name: row.name, city: row.city, branch: `${row.city} Branch`, address: row.address ?? "Address not confirmed", phone: row.contact_number ?? "", hours: row.operating_hours, latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined }));
  }, force);
}
const cartCache = createReadCache<ApiCart>(CACHE_AGE.private, Date.now, 1);
export const { getCart, addCartItem, changeCartItem, deleteCartItem } = createCartApi(apiRequest, cartCache, getSessionRevision);
export type Checkout = { cart: { items: { id: number; quantity: number; product: { id: number; name: string; brand: string | null; image_url: string | null }; unit_price: string; line_total: string }[]; item_count: number; total_quantity: number; total: string }; pickup_location: { name: string; address: string; contact_number: string | null; operating_hours: string }; customer: { name: string; default_delivery_address: string | null }; fulfillment_methods: { value: string; label: string }[]; payment_methods: { value: string; label: string; requires_proof: boolean; available_for: string[]; payment_account: { account_name: string; account_number: string; is_demo: boolean } | null }[] };
export async function getCheckout() { return (await apiRequest<Envelope<Checkout>>("checkout")).data; }
export type RecommendationOptions = { intended_uses: { value: string; label: string }[]; filter_options: Filters };
export type Recommendation = { product: ApiProduct; effective_price: string; reasons: string[] };
const recommendationOptionsCache = createReadCache<RecommendationOptions>(CACHE_AGE.filters, Date.now, 1);
export function getRecommendationOptions() { return recommendationOptionsCache.read("options", async () => (await apiRequest<Envelope<RecommendationOptions>>("recommendations/options")).data); }
export async function getRecommendations(criteria: { budget: string; intended_use: string; category_id?: number; preferred_brand?: string; tag_ids?: number[] }) {
  return (await apiRequest<Envelope<Recommendation[]>>("recommendations", { method: "POST", body: JSON.stringify(criteria) })).data;
}
