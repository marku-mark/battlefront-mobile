import { banners, type Banner, type Brand, type Category, type Product } from "./data";
import { databasePromise, initializeCatalogDatabase } from "./database";
import { productImages } from "./productImages";

const MOCK_DELAY_MS = 0; // set > 0 to simulate network latency during dev
const PRODUCT_CACHE_TTL_MS = 30_000;
const MAX_CACHED_PRODUCTS = 20;

type ProductRow = {
  id: string;
  name: string;
  category_id: string;
  brand_id: string;
  price: number;
  image_key: string;
  stock_quantity: number;
  variant_name: string | null;
};

const PRODUCT_SELECT = `SELECT p.id, p.name, p.category_id, p.brand_id, p.price, p.image_key, p.stock_quantity, v.name AS variant_name FROM products p LEFT JOIN product_variants v ON v.product_id = p.id`;
const productCache = new Map<string, { product: Product | null; expiresAt: number }>();
const productRequests = new Map<string, Promise<Product | null>>();

export type HomeCatalog = {
  catalogProducts: Product[];
  flashDeals: Product[];
  sulitPicks: Product[];
  newArrivals: Product[];
};

function resolveAfter<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));
}

export async function getCategories(): Promise<Category[]> {
  await initializeCatalogDatabase();
  const rows = await (await databasePromise).getAllAsync<{ id: string; name: string }>("SELECT id, name FROM categories ORDER BY name");
  return rows.map((row) => ({ id: row.id, name: row.name, icon: getCategoryIcon(row.name) }));
}

export async function getBanners(): Promise<Banner[]> {
  return resolveAfter(banners);
}

export async function getHomeCatalog(): Promise<HomeCatalog> {
  const catalogProducts = await getProducts();

  return {
    catalogProducts,
    flashDeals: catalogProducts
      .filter((product) => product.stockQuantity === undefined || product.stockQuantity > 0)
      .slice(0, 12),
    sulitPicks: [...catalogProducts]
      .sort((left, right) => left.price - right.price)
      .slice(0, 12),
    newArrivals: catalogProducts.slice(12, 24),
  };
}

export async function getFlashDeals(): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.stockQuantity === undefined || product.stockQuantity > 0).slice(0, 12);
}

export async function getSulitPicks(): Promise<Product[]> {
  const products = await getProducts();
  return [...products].sort((left, right) => left.price - right.price).slice(0, 12);
}

export async function getNewArrivals(): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(12, 24);
}

export async function getProducts(): Promise<Product[]> {
  await initializeCatalogDatabase();
  const rows = await (await databasePromise).getAllAsync<ProductRow>(`${PRODUCT_SELECT} ORDER BY p.name`);

  return rows.map(mapProduct);
}

export function getProductById(productId: string): Promise<Product | null> {
  const cached = productCache.get(productId);
  if (cached && cached.expiresAt > Date.now()) {
    productCache.delete(productId);
    productCache.set(productId, cached);
    return Promise.resolve(cached.product);
  }
  productCache.delete(productId);

  const existingRequest = productRequests.get(productId);
  if (existingRequest) return existingRequest;

  const request = loadProductById(productId).then((product) => {
    productCache.set(productId, { product, expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS });
    if (productCache.size > MAX_CACHED_PRODUCTS) {
      const oldestProductId = productCache.keys().next().value;
      if (oldestProductId !== undefined) productCache.delete(oldestProductId);
    }
    return product;
  }).finally(() => {
    productRequests.delete(productId);
  });

  productRequests.set(productId, request);
  return request;
}

export function prefetchProductById(productId: string): void {
  void getProductById(productId).catch(() => undefined);
}

async function loadProductById(productId: string): Promise<Product | null> {
  await initializeCatalogDatabase();
  const row = await (await databasePromise).getFirstAsync<ProductRow>(
    `${PRODUCT_SELECT} WHERE p.id = ? LIMIT 1`,
    productId
  );

  return row ? mapProduct(row) : null;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    brandId: row.brand_id,
    price: row.price,
    image: productImages[row.image_key],
    stockQuantity: row.stock_quantity,
    rating: 0,
    reviewCount: 0,
    variants: row.variant_name ? [row.variant_name] : [],
  };
}

export async function getBrands(): Promise<Brand[]> {
  await initializeCatalogDatabase();
  const rows = await (await databasePromise).getAllAsync<{ id: string; name: string }>("SELECT id, name FROM brands ORDER BY name");
  return rows.map((row) => ({ id: row.id, name: row.name, logo: "" }));
}

function getCategoryIcon(name: string): string {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes("processor") || normalizedName.includes("component")) return "hardware-chip-outline";
  if (normalizedName.includes("laptop")) return "laptop-outline";
  if (normalizedName.includes("monitor") || normalizedName.includes("display")) return "tv-outline";
  if (normalizedName.includes("network")) return "wifi-outline";
  if (normalizedName.includes("storage")) return "server-outline";
  if (normalizedName.includes("keyboard") || normalizedName.includes("mouse")) return "game-controller-outline";
  return "cube-outline";
}

// Flash deal countdown target — replace with a real deal-end timestamp
// once deals come from a backend.
export function getFlashDealEndTime(): Date {
  const end = new Date();
  end.setHours(end.getHours() + 6);
  return end;
}

export async function getChatbotReply(message: string): Promise<string> {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("order")) {
    return "Order tracking will be available once you sign in. I can still help you find a product in the meantime.";
  }
  if (normalizedMessage.includes("gpu") || normalizedMessage.includes("graphics")) {
    return "For graphics cards, check Flash Deals for current GPU offers. Tell me your budget and target games for a more specific recommendation.";
  }
  if (normalizedMessage.includes("laptop")) {
    return "We have laptops for work, school, and gaming. Open Categories and choose Laptops to browse the current selection.";
  }
  if (normalizedMessage.includes("shipping") || normalizedMessage.includes("delivery")) {
    return "Delivery options depend on your location. Shipping details will be shown during checkout once the cart flow is connected.";
  }

  return "I can help with products, orders, GPUs, laptops, and delivery. What would you like to know?";
}
