export type UnavailableWishlistRow = { id: string; unavailable: true };
export function wishlistRows<T extends { id: string }>(ids: string[], products: T[]): (T | UnavailableWishlistRow)[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id) ?? { id, unavailable: true });
}
