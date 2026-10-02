import { banners, type Banner, type Brand, type Category, type Product, type Store } from "./data";
import { ApiError, collectPages, createApiClient, retryRateLimitedRead } from "./apiClient";
import type { ApiCart } from "./cartState";
export type { ApiCart } from "./cartState";
export { ApiError } from "./apiClient";
let accessToken: string | null = null;
let localUserId: number | null = null;
let chatContext: string | null = null;
let chatGeneration = 0;
const sessionListeners = new Set<() => void>();
export function setAccessToken(token: string | null, userId: number | null = null) { accessToken = token; localUserId = userId; resetChatContext(); }
export function getLocalUserId() { return localUserId ?? "guest"; }
export function onSessionExpired(listener: () => void) { sessionListeners.add(listener); return () => { sessionListeners.delete(listener); }; }
export function resetChatContext() { chatContext = null; chatGeneration++; }
export const apiRequest = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? "", () => accessToken, () => {
  setAccessToken(null);
  sessionListeners.forEach((listener) => listener());
});
type Envelope<T> = { data: T };
export type ApiUser = { id: number; name: string; email: string; default_delivery_address: string | null };
export async function login(email: string, password: string) {
  return (await apiRequest<Envelope<{ user: ApiUser; token: string; expires_at: string }>>("auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password, device_name: "Battlefront Expo" }) })).data;
}
export async function logout() { await apiRequest<void>("auth/logout", { method: "POST" }); }
export async function getProfile() { return (await apiRequest<Envelope<ApiUser>>("profile")).data; }
export async function updateProfile(fields: { name: string; email: string; default_delivery_address?: string | null }) {
  return (await apiRequest<Envelope<ApiUser>>("profile", { method: "PATCH", body: JSON.stringify(fields) })).data;
}
export type ApiProduct = {
  id: number; name: string; description?: string | null; brand: string | null; price: string; discount_price: string | null;
  image_url: string | null; category: { id: number; name: string }; tags?: { id: number; name: string }[]; inventory?: { status: string };
};
export function mapProduct(row: ApiProduct): Product {
  return { id: String(row.id), name: row.name, categoryId: String(row.category.id), categorySlug: `category-${row.category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, brandId: row.brand ?? "",
    price: Number(row.discount_price ?? row.price), originalPrice: row.discount_price ? Number(row.price) : undefined,
    image: row.image_url ?? "", availability: row.inventory?.status ?? "in_stock", variants: [],
    performanceTier: row.tags?.map((tag) => tag.name).join(", "), rating: 0, reviewCount: 0 };
}
type Filters = { categories: { id: number; name: string }[]; brands: string[] };
const readCatalog = retryRateLimitedRead(apiRequest);
let filterPromise: Promise<Filters> | null = null;
function getFilters() { return filterPromise ??= readCatalog<Envelope<Filters>>("products/filters").then((result) => result.data).catch((error) => { filterPromise = null; throw error; }); }
export async function getCategories(): Promise<Category[]> { return (await getFilters()).categories.map((row) => ({ id: String(row.id), name: row.name, icon: "cube-outline" })); }
export async function getBrands(): Promise<Brand[]> { return (await getFilters()).brands.map((name) => ({ id: name, name, logo: "" })); }
let catalogPromise: Promise<Product[]> | null = null;
let catalogExpires = 0;
export function invalidateCatalog() { catalogPromise = null; catalogExpires = 0; filterPromise = null; }
export function getProducts(): Promise<Product[]> {
  if (catalogPromise && catalogExpires > Date.now()) return catalogPromise;
  catalogExpires = Date.now() + 10 * 60_000;
  catalogPromise = collectPages<ApiProduct>(readCatalog, "products").then((rows) => rows.map(mapProduct)).catch((error) => { catalogPromise = null; throw error; });
  return catalogPromise;
}
export async function getProductById(id: string): Promise<Product | null> {
  try { return mapProduct((await apiRequest<Envelope<ApiProduct>>(`products/${encodeURIComponent(id)}`)).data); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}
export function prefetchProductById(_id: string): void {}
export type HomeCatalog = { catalogProducts: Product[]; flashDeals: Product[]; sulitPicks: Product[]; newArrivals: Product[] };
export async function getHomeCatalog(): Promise<HomeCatalog> {
  const catalogProducts = await getProducts();
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
export type Checkout = { cart: { total: string }; pickup_location: { name: string; address: string; contact_number: string | null; operating_hours: string }; customer: { name: string; default_delivery_address: string | null }; fulfillment_methods: { value: string; label: string }[]; payment_methods: { value: string; label: string; requires_proof: boolean; available_for: string[]; payment_account: { account_name: string; account_number: string; is_demo: boolean } | null }[] };
export async function getCheckout() { return (await apiRequest<Envelope<Checkout>>("checkout")).data; }
export type RecommendationOptions = { intended_uses: { value: string; label: string }[]; filter_options: Filters };
export type Recommendation = { product: ApiProduct; effective_price: string; reasons: string[] };
export async function getRecommendationOptions() { return (await apiRequest<Envelope<RecommendationOptions>>("recommendations/options")).data; }
export async function getRecommendations(criteria: { budget: string; intended_use: string; category_id?: number; preferred_brand?: string; tag_ids?: number[] }) {
  return (await apiRequest<Envelope<Recommendation[]>>("recommendations", { method: "POST", body: JSON.stringify(criteria) })).data;
}
