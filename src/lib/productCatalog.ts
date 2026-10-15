import type { Product } from "./data";

export type ApiProduct = {
  id: number; name: string; description?: string | null; brand: string | null; price: string; discount_price: string | null;
  image_url: string | null; category: { id: number; name: string }; tags?: { id: number; name: string }[]; inventory?: { status: string; quantity?: number | null };
};

export function mapProduct(row: ApiProduct): Product {
  return { id: String(row.id), name: row.name, description: row.description ?? null, categoryId: String(row.category.id), categoryName: row.category.name,
    categorySlug: `category-${row.category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, brandId: row.brand ?? "",
    price: Number(row.discount_price ?? row.price), originalPrice: row.discount_price ? Number(row.price) : undefined,
    image: row.image_url ?? "", availability: row.inventory?.status ?? "unavailable",
    stockQuantity: Number.isInteger(row.inventory?.quantity) && (row.inventory?.quantity ?? -1) >= 0 ? row.inventory?.quantity ?? undefined : undefined,
    variants: [],
    performanceTier: row.tags?.map((tag) => tag.name).join(", "), rating: 0, reviewCount: 0 };
}

export function getProductFacts(product: Product) {
  const stock = getProductStock(product);
  const availability = stock.statusLabel;
  const specifications: [string, string][] = [["Category", product.categoryName || "Not provided"], ["Availability", availability]];
  if (stock.quantityLabel !== "Quantity unavailable") specifications.push(["Available quantity", String(stock.maxQuantity)]);
  if (product.brandId) specifications.push(["Brand", product.brandId]);
  return {
    description: product.description?.trim() || "No description has been provided for this product.",
    availability,
    specifications,
    compatibility: "Check the product description for specifications and contact Battlefront to confirm compatibility and warranty details before ordering.",
  };
}

export function getProductStock(product: Product) {
  const quantity = product.stockQuantity;
  const isOutOfStock = product.availability === "out_of_stock";
  const isUnavailable = product.availability === "unavailable";
  const hasQuantity = Number.isInteger(quantity) && quantity !== undefined && quantity >= 0;
  const maxQuantity = !isOutOfStock && !isUnavailable && hasQuantity ? quantity : 0;
  return {
    maxQuantity,
    statusLabel: isUnavailable || (!isOutOfStock && !hasQuantity)
      ? "Quantity unavailable"
      : maxQuantity === 0 ? "Out of stock" : product.availability === "low_stock" ? "Low stock" : "In stock",
    quantityLabel: isUnavailable ? "Quantity unavailable"
      : isOutOfStock || (hasQuantity && quantity === 0) ? "0 available"
      : hasQuantity ? `${quantity} available` : "Quantity unavailable",
  };
}

export async function loadProductSearchPage(request: <T>(path: string) => Promise<T>, query: string, page = 1): Promise<{ data: Product[]; meta: { current_page: number; last_page: number; total: number } }> {
  const term = query.trim();
  if (term.length < 2) return { data: [], meta: { current_page: 1, last_page: 1, total: 0 } };
  const result = await request<{ data: ApiProduct[]; meta: { current_page: number; last_page: number; total: number } }>("products?q=" + encodeURIComponent(term) + "&page=" + page);
  return { ...result, data: result.data.map(mapProduct) };
}
