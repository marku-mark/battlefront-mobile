import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { getProductById } from "@/lib/api";
import type { Product } from "@/lib/data";

const RECENTLY_VIEWED_STORAGE_KEY = "battlefront-api-recently-viewed";
const MAX_RECENT_ITEMS = 8;

export async function getRecentlyViewedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validIds = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return validIds.slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

export async function addRecentlyViewedProduct(productId: string): Promise<void> {
  if (!productId) return;

  try {
    const existingIds = await getRecentlyViewedIds();
    const nextIds = [productId, ...existingIds.filter((id) => id !== productId)].slice(0, MAX_RECENT_ITEMS);
    await AsyncStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(nextIds));
  } catch {
    // Ignore persistence failures so the product experience still works in demo mode.
  }
}

export function useRecentlyViewedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const recentIds = await getRecentlyViewedIds();
      if (recentIds.length === 0) {
        setProducts([]);
        return;
      }

      const loadedProducts = await Promise.all(recentIds.map((productId) => getProductById(productId)));
      setProducts(loadedProducts.filter((product): product is Product => Boolean(product)));
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { products, isLoading, refresh };
}
