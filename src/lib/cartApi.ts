type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
type CartCache<T> = {
  read: (key: string, load: () => Promise<T>, force?: boolean) => Promise<T>;
  clear: () => void;
  seed: (key: string, value: T) => void;
};

export function createCartApi<T>(request: Request, cache: CartCache<T>, getSessionRevision: () => number) {
  async function mutate(path: string, options: RequestInit) {
    const revision = getSessionRevision();
    const cart = (await request<{ data: T }>(path, options)).data;
    if (revision === getSessionRevision()) { cache.clear(); cache.seed("cart", cart); }
    return cart;
  }
  return {
    getCart(force = false) { return cache.read("cart", async () => (await request<{ data: T }>("cart")).data, force); },
    addCartItem(productId: string, quantity: number) { return mutate("cart/items", { method: "POST", body: JSON.stringify({ product_id: Number(productId), quantity }) }); },
    changeCartItem(id: number, quantity: number) { return mutate(`cart/items/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) }); },
    deleteCartItem(id: number) { return mutate(`cart/items/${id}`, { method: "DELETE" }); },
  };
}
