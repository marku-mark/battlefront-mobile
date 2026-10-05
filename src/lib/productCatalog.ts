import type { Product } from "./data";

export type ApiProduct = {
  id: number; name: string; description?: string | null; brand: string | null; price: string; discount_price: string | null;
  image_url: string | null; category: { id: number; name: string }; tags?: { id: number; name: string }[]; inventory?: { status: string };
};

export function mapProduct(row: ApiProduct): Product {
  return { id: String(row.id), name: row.name, description: row.description ?? null, categoryId: String(row.category.id), categoryName: row.category.name,
    categorySlug: `category-${row.category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, brandId: row.brand ?? "",
    price: Number(row.discount_price ?? row.price), originalPrice: row.discount_price ? Number(row.price) : undefined,
    image: row.image_url ?? "", availability: row.inventory?.status ?? "unavailable", variants: [],
    performanceTier: row.tags?.map((tag) => tag.name).join(", "), rating: 0, reviewCount: 0 };
}

export function getProductFacts(product: Product) {
  const availability = { in_stock: "In stock", low_stock: "Low stock", out_of_stock: "Out of stock" }[product.availability ?? ""] ?? "Unavailable";
  const specifications: [string, string][] = [["Category", product.categoryName || "Not provided"], ["Availability", availability]];
  if (product.brandId) specifications.push(["Brand", product.brandId]);
  return {
    description: product.description?.trim() || "No description has been provided for this product.",
    availability,
    specifications,
    compatibility: "Check the product description for specifications and contact Battlefront to confirm compatibility and warranty details before ordering.",
  };
}
