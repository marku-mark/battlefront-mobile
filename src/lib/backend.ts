import { createChatApi } from "./chatApi";
import { createDeliveryDirectory } from "./deliveryDirectory";
import { fetch as expoFetch } from "expo/fetch";
import { createCategoryCachePool } from "./categoryQuery";
import { CACHE_AGE } from "./cachePolicy";
import { createCartApi } from "./cartApi";
import { loadProductSearchPage } from "./productCatalog";
import { createReadCache, loadSelectedProducts } from "./readCache";
import type { ApiUser, ProfileInput } from "./accountApi";
import { type Brand, type Category, type Product, type Store } from "./data";
import { ApiError, createApiClient, createCachedRead, createPacedRead, type Page } from "./apiClient";
import { createProgressiveCatalog } from "./catalogCache";
import { createAccountApi } from "./accountApi";
import { mapProduct, type ApiProduct } from "./productCatalog";
export { mapProduct, type ApiProduct } from "./productCatalog";
export type { ApiUser, AuthResult, ProfileInput, RegistrationInput, VerificationContext } from "./accountApi";
import type { ApiCart } from "./cartState";
export type { ApiCart } from "./cartState";
export { ApiError } from "./apiClient";
let sessionRevision = 0;
export function getSessionRevision() { return sessionRevision; }
let accessToken: string | null = null;
let localUserId: number | null = null;
const sessionChangeListeners = new Set<() => void>();
export function onSessionChange(listener: () => void) { sessionChangeListeners.add(listener); return () => { sessionChangeListeners.delete(listener); }; }
const sessionListeners = new Set<() => void>();
export function setAccessToken(token: string | null, userId: number | null = null) {
  const changed = accessToken !== token || localUserId !== userId;
  accessToken = token; localUserId = userId;
  if (changed) { sessionRevision++; profileCache.clear(); cartCache.clear(); sessionChangeListeners.forEach((listener) => listener()); }
  if (changed) resetChatContext();
}
export function getLocalUserId() { return localUserId ?? "guest"; }
export function onSessionExpired(listener: () => void) { sessionListeners.add(listener); return () => { sessionListeners.delete(listener); }; }
export function resetChatContext() { chat.reset(); }
export const apiRequest = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? "", () => accessToken, () => {
  setAccessToken(null);
  sessionListeners.forEach((listener) => listener());
}, Date.now, expoFetch);
export function authenticatedMediaSource(path: string) {
  const apiRoot = process.env.EXPO_PUBLIC_API_URL ?? "";
  const appRoot = apiRoot.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  return { uri: /^https?:\/\//i.test(path) ? path : new URL(path, `${appRoot}/`).toString(), headers };
}
export function passwordResetUrl(email: string) {
  const apiRoot = process.env.EXPO_PUBLIC_API_URL ?? "";
  const appRoot = apiRoot.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(appRoot)) throw new Error("Set EXPO_PUBLIC_API_URL to the Battlefront server URL.");
  return `${appRoot}/forgot-password?email=${encodeURIComponent(email.trim())}`;
}
type Envelope<T> = { data: T };
const account = createAccountApi(apiRequest);
const profileCache = createReadCache<ApiUser>(30_000, Date.now, 1);
export const { login, register, logout, changePassword, verifyEmail, resendVerification } = account;
export function getProfile(force = false) { return profileCache.read("profile", account.getProfile, force); }
export async function updateProfile(fields: ProfileInput) {
  const owner = sessionRevision;
  const user = await account.updateProfile(fields);
  if (owner === sessionRevision) { profileCache.clear(); profileCache.seed("profile", user); invalidateBehavioralRecommendations(); }
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
let activeSearchTerm = "";
let searchRequestRevision = 0;
const catalogCache = createProgressiveCatalog(async (page, shouldContinue) => {
  const revision = productRevision;
  const result = await readCatalog<Page<ApiProduct>>(`products?page=${page}`, undefined, shouldContinue);
  const products = result.data.map(mapProduct);
  if (revision === productRevision) products.forEach((product) => productCache.seed(product.id, product));
  return { ...result, data: products };
}, CACHE_AGE.products);
export const getCategoryCatalog = createCategoryCachePool((key: string) => ({
  pager: createProgressiveCatalog(async (page, shouldContinue) => {
    const result = await readCatalog<Page<ApiProduct>>("products?" + key + "&page=" + page, undefined, shouldContinue);
    return { ...result, data: result.data.map(mapProduct) };
  }, CACHE_AGE.products),
  scrollOffset: 0,
}));
export function invalidateCatalog(refreshFilters = false) {
  productRevision++; catalogCache.invalidate(); productCache.clear(); searchCache.clear();
  getCategoryCatalog.invalidate((entry) => entry.pager.invalidate());
  invalidateBehavioralRecommendations();
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
    try {
      const product = mapProduct((await apiRequest<Envelope<ApiProduct>>("products/" + encodeURIComponent(id))).data);
      invalidateBehavioralRecommendations();
      return product;
    }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  });
}
export function getSelectedProducts(ids: string[], shouldContinue?: () => boolean) { return loadSelectedProducts(ids, getProductById, 3, shouldContinue); }
export function searchProductPage(query: string, page = 1): Promise<Page<Product>> {
  const term = query.trim();
  if (term.length < 2) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } });
  if (term !== activeSearchTerm) { activeSearchTerm = term; searchRequestRevision++; }
  const ownerRevision = searchRequestRevision;
  return searchCache.read(JSON.stringify([term, page]), async () => {
    const revision = productRevision;
    const requestSearchPage = <T,>(path: string) => readCatalog<T>(path, undefined, () => ownerRevision === searchRequestRevision);
    const result = await loadProductSearchPage(requestSearchPage, term, page);
    if (page === 1) invalidateBehavioralRecommendations();
    const products = result.data;
    if (revision === productRevision) products.forEach((product) => productCache.seed(product.id, product));
    return { ...result, data: products };
  });
}
export function cancelPendingProductSearches() { activeSearchTerm = ""; searchRequestRevision++; }
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
export async function getFlashDeals() { return (await getHomeCatalog()).flashDeals; }
export async function getSulitPicks() { return (await getHomeCatalog()).sulitPicks; }
export async function getNewArrivals() { return (await getHomeCatalog()).newArrivals; }
const chat = createChatApi(apiRequest);
export const getChatbotReply = chat.reply;
const branchCache = createReadCache<Store[]>(CACHE_AGE.branches, Date.now, 1);
export function getBranches(force = false): Promise<Store[]> {
  return branchCache.read("branches", async () => {
    const result = await apiRequest<Envelope<{ id: number; name: string; city: string; address: string | null; contact_number: string | null; operating_hours: string; latitude: number | null; longitude: number | null }[]>>("branches");
    return result.data.map((row) => ({ id: String(row.id), name: row.name, city: row.city, branch: `${row.city} Branch`, address: row.address ?? "Address not confirmed", phone: row.contact_number ?? "", hours: row.operating_hours, latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined }));
  }, force);
}
const cartCache = createReadCache<ApiCart>(CACHE_AGE.private, Date.now, 1);
const cart = createCartApi(apiRequest, cartCache, getSessionRevision);
export const getCart = cart.getCart;
export async function addCartItem(productId: string, quantity: number) {
  const result = await cart.addCartItem(productId, quantity);
  invalidateBehavioralRecommendations();
  return result;
}
export async function changeCartItem(id: number, quantity: number) {
  const result = await cart.changeCartItem(id, quantity);
  invalidateBehavioralRecommendations();
  return result;
}
export async function deleteCartItem(id: number) {
  const result = await cart.deleteCartItem(id);
  invalidateBehavioralRecommendations();
  return result;
}
export type CheckoutQuote = { product_subtotal: string; delivery_fee: string; total: string };
export type DeliveryQuote = CheckoutQuote & { destination: string; carrier: string; packing_expectation: string; base_fee: string; handling_surcharge: string; preparation_days: number; estimated_delivery_start: string; estimated_delivery_end: string; notice: string; is_demo: boolean; assumption_label: string };
export type DeliveryLocation = import("./deliveryAddress").DeliveryLocation;
export type DeliveryAddress = import("./deliveryAddress").DeliveryAddress;
export type DeliveryCity = { code: string; name: string; destination: string; region_code: string; province_code: string | null; type: "city" | "municipality"; city_class: "CC" | "HUC" | null };
export type DeliveryProvince = { code: string; name: string; region_code: string };
export type SelectedDeliveryQuote = Omit<DeliveryQuote, "carrier" | "packing_expectation" | "base_fee" | "handling_surcharge" | "preparation_days" | "estimated_delivery_start" | "estimated_delivery_end"> & { pricing_configured: boolean; order_placement_allowed: boolean; payment_methods: string[]; destination_label: string; carrier: string | null; packing_expectation: string | null; base_fee: string | null; handling_surcharge: string | null; preparation_days: number | null; estimated_delivery_start: string | null; estimated_delivery_end: string | null };
const directory = createDeliveryDirectory(apiRequest);
export const getDeliveryLocations = directory.locations;
export const resolveDeliveryLocation = directory.resolveCity;
export const getNegrosDeliveryLocations = directory.negrosLocations;
export async function getDeliveryQuote(cityCode: string, cartItemIds: number[]): Promise<{ available: boolean; quote: SelectedDeliveryQuote | null; notice?: string }> {
  const query = [`delivery_city_code=${encodeURIComponent(cityCode)}`, ...cartItemIds.map((id) => `cart_item_ids[]=${encodeURIComponent(id)}`)].join("&");
  return (await apiRequest<Envelope<{ available: boolean; quote: SelectedDeliveryQuote | null; notice?: string }>>(`checkout/delivery-quote?${query}`)).data;
}
export type Checkout = { cart: { items: { id: number; quantity: number; pc_build_group?: { uuid: string; name: string } | null; product: { id: number; name: string; brand: string | null; image_url: string | null }; unit_price: string; line_total: string }[]; item_count: number; total_quantity: number; total: string }; pickup_quote: CheckoutQuote; delivery_quotes: DeliveryQuote[]; delivery_locations: DeliveryLocation[]; delivery_address_prefill: DeliveryAddress; pickup_location: { name: string; address: string; contact_number: string | null; operating_hours: string }; customer: { name: string; default_delivery_address: string | null; default_delivery_contact_number?: string | null }; fulfillment_methods: { value: string; label: string }[]; paymongo_hosted_methods?: string[]; payment_methods: { value: string; label: string; requires_proof: boolean; available_for: string[]; payment_account: { account_name: string; account_number: string; is_demo: boolean } | null }[] };
export async function getCheckout(cartItemIds: number[]) {
  const query = cartItemIds.map((id) => `cart_item_ids[]=${encodeURIComponent(id)}`).join("&");
  return (await apiRequest<Envelope<Checkout>>(`checkout?${query}`)).data;
}
export async function recordProductDwell(productId: string, seconds: number): Promise<void> {
  await apiRequest(`products/${encodeURIComponent(productId)}/dwell`, { method: "POST", body: JSON.stringify({ seconds }) });
}
export async function recordProductView(productId: string): Promise<void> {
  await apiRequest(`products/${encodeURIComponent(productId)}/view`, { method: "POST" });
}
export async function getWishlist(): Promise<{ items: { product_id: number; is_available: boolean; can_add_to_cart: boolean; product: ApiProduct | null }[]; count: number }> {
  const result = await apiRequest<{ data: { product_id: number; is_available: boolean; can_add_to_cart: boolean; product: ApiProduct | null }[]; count: number }>("wishlist");
  return { items: result.data, count: result.count };
}
export async function addWishlistProduct(productId: string): Promise<void> {
  await apiRequest("wishlist", { method: "POST", body: JSON.stringify({ product_id: Number(productId) }) });
}
export async function removeWishlistProduct(productId: string): Promise<void> {
  await apiRequest(`wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });
}
export type BehavioralRecommendationReason = { code: string; value: string };
export type BehavioralRecommendation = { product: Product; effective_price: string; reasons: BehavioralRecommendationReason[] };
const behavioralRecommendationCache = createReadCache<BehavioralRecommendation[]>(CACHE_AGE.private, Date.now, 4);
const recommendationInteractionRequest = createPacedRead(apiRequest, 3000);
const recentRecommendationImpressions = new Map<string, number>();
onSessionChange(() => behavioralRecommendationCache.clear());
export function invalidateBehavioralRecommendations() { behavioralRecommendationCache.clear(); }
export function getBehavioralRecommendations(force = false): Promise<BehavioralRecommendation[]> {
  const ownerRevision = sessionRevision;
  return behavioralRecommendationCache.read(String(ownerRevision), async () => {
    const result = await apiRequest<Envelope<{ product: ApiProduct; effective_price: string; reasons: BehavioralRecommendationReason[] }[]>>("recommendations");
    if (ownerRevision !== sessionRevision) throw new Error("Your account changed. Reload recommendations.");
    return result.data.map((recommendation) => ({ ...recommendation, product: mapProduct(recommendation.product) }));
  }, force);
}
export type RecommendationInteractionType = "impression" | "click" | "dismiss" | "report_wrong";
export type RecommendationPlacement = "home" | "product" | "cart" | "recommendations";
export async function recordRecommendationInteraction(input: {
  productId: string;
  eventType: RecommendationInteractionType;
  placement: RecommendationPlacement;
  position: number;
  reasonCode?: string;
  sessionRevision?: number;
}): Promise<void> {
  const ownerRevision = input.sessionRevision ?? sessionRevision;
  if (ownerRevision !== sessionRevision) return;
  const now = Date.now();
  for (const [key, expiresAt] of recentRecommendationImpressions) {
    if (expiresAt <= now) recentRecommendationImpressions.delete(key);
  }
  const impressionKey = `${ownerRevision}:${input.placement}:${input.productId}`;
  if (input.eventType === "impression") {
    if ((recentRecommendationImpressions.get(impressionKey) ?? 0) > now) return;
    recentRecommendationImpressions.set(impressionKey, now + 5 * 60_000);
  }
  const eventId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
  try {
    await recommendationInteractionRequest<void>("recommendations/interactions", {
      method: "POST",
      body: JSON.stringify({
        event_id: eventId,
        product_id: Number(input.productId),
        event_type: input.eventType,
        placement: input.placement,
        position: Math.min(Math.max(Math.trunc(input.position), 1), 12),
        reason_code: input.reasonCode,
      }),
    }, () => ownerRevision === sessionRevision);
  } catch (error) {
    if (input.eventType === "impression" && recentRecommendationImpressions.get(impressionKey) === now + 5 * 60_000) {
      recentRecommendationImpressions.delete(impressionKey);
    }
    throw error;
  }
}
