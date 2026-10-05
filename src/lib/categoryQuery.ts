export type CategoryQuery = { categoryIds: string[]; brand: string | null; query: string; price: "all" | "under-5k" | "under-15k" | "over-15k"; sort: "featured" | "price-low" | "price-high" };

export function categoryQueryString(filters: CategoryQuery): string {
  const params = new URLSearchParams();
  [...new Set(filters.categoryIds)].sort().forEach((id, index) => params.set("category_ids[" + index + "]", id));
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.price === "under-5k") params.set("max_price", "4999.99");
  if (filters.price === "under-15k") params.set("max_price", "14999.99");
  if (filters.price === "over-15k") params.set("min_price", "15000");
  params.set("sort", filters.sort === "price-low" ? "price_asc" : filters.sort === "price-high" ? "price_desc" : "featured");
  return params.toString();
}

export function createCategoryCachePool<T>(create: (key: string) => T, limit = 20) {
  const entries = new Map<string, T>();
  return (key: string): T => {
    const existing = entries.get(key);
    if (existing !== undefined) { entries.delete(key); entries.set(key, existing); return existing; }
    const value = create(key);
    entries.set(key, value);
    if (entries.size > limit) entries.delete(entries.keys().next().value!);
    return value;
  };
}
