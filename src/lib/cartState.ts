import type { Product } from "./data";

export type ApiCart = {
  items: {
    id: number;
    quantity: number;
    product: { id: number; name: string; brand: string | null; image_url: string | null; category: string; price: string; discount_price: string | null };
    availability: { status: string; available_quantity: number | null };
    unit_price: string;
    line_total: string;
  }[];
  total: string;
  total_quantity: number;
  conflict_count: number;
};
export type CartItem = { product: Product; quantity: number; variant?: string | null; serverId?: number; lineTotal: number };

export function cartSnapshot(cart: ApiCart) {
  return {
    items: cart.items.map((row): CartItem => ({
      serverId: row.id, quantity: row.quantity, variant: null, lineTotal: Number(row.line_total),
      product: {
        id: String(row.product.id), name: row.product.name, categoryId: "",
        categorySlug: `category-${row.product.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        brandId: row.product.brand ?? "", image: row.product.image_url ?? "",
        price: Number(row.unit_price), stockQuantity: row.availability.available_quantity ?? 0,
        availability: row.availability.status, variants: [],
      },
    })),
    subtotal: Number(cart.total), conflictCount: cart.conflict_count,
  };
}

export function createCartQueue() {
  let tail = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
