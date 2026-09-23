import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type WishlistContextValue = {
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const WISHLIST_STORAGE_KEY = "battlefront-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WISHLIST_STORAGE_KEY)
      .then((storedWishlist) => {
        if (!storedWishlist) return;
        const parsedWishlist = JSON.parse(storedWishlist) as unknown;
        if (Array.isArray(parsedWishlist) && parsedWishlist.every((id) => typeof id === "string")) {
          setProductIds(parsedWishlist);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(productIds)).catch(() => undefined);
  }, [isHydrated, productIds]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      isWishlisted: (productId) => productIds.includes(productId),
      toggleWishlist: (productId) => {
        setProductIds((current) =>
          current.includes(productId)
            ? current.filter((id) => id !== productId)
            : [...current, productId]
        );
      },
    }),
    [productIds]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}