import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type WishlistContextValue = {
  items: string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
type Listener = () => void;

type WishlistStore = {
  getItems: () => string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  setItems: (items: string[]) => void;
  subscribe: (listener: Listener) => () => void;
  subscribeToProduct: (productId: string, listener: Listener) => () => void;
};

const WishlistStoreContext = createContext<WishlistStore | null>(null);
const WISHLIST_STORAGE_KEY = "battlefront-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createWishlistStore);
  const [isHydrated, setIsHydrated] = useState(false);
  const productIds = useSyncExternalStore(store.subscribe, store.getItems, store.getItems);

  useEffect(() => {
    AsyncStorage.getItem(WISHLIST_STORAGE_KEY)
      .then((storedWishlist) => {
        if (!storedWishlist) return;
        const parsedWishlist = JSON.parse(storedWishlist) as unknown;
        if (Array.isArray(parsedWishlist) && parsedWishlist.every((id) => typeof id === "string")) {
          store.setItems(parsedWishlist);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, [store]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(productIds)).catch(() => undefined);
  }, [isHydrated, productIds]);

  const value = useMemo<WishlistContextValue>(
    () => ({ items: productIds, isWishlisted: store.isWishlisted, toggleWishlist: store.toggleWishlist }),
    [productIds, store]
  );

  return (
    <WishlistStoreContext.Provider value={store}>
      <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
    </WishlistStoreContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}

export function useWishlistActions(): (productId: string) => void {
  return useWishlistStore().toggleWishlist;
}

export function useIsWishlisted(productId: string): boolean {
  const store = useWishlistStore();
  const subscribe = useCallback(
    (listener: Listener) => store.subscribeToProduct(productId, listener),
    [productId, store]
  );
  const getSnapshot = useCallback(() => store.isWishlisted(productId), [productId, store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useWishlistStore(): WishlistStore {
  const store = useContext(WishlistStoreContext);
  if (!store) throw new Error("Wishlist hooks must be used inside WishlistProvider");
  return store;
}

function createWishlistStore(): WishlistStore {
  let items: string[] = [];
  const listeners = new Set<Listener>();
  const productListeners = new Map<string, Set<Listener>>();

  function setItems(nextItems: string[]) {
    if (items === nextItems) return;

    const previousIds = new Set(items);
    const nextIds = new Set(nextItems);
    const changedIds = new Set([...previousIds, ...nextIds]);
    items = nextItems;
    listeners.forEach((listener) => listener());

    changedIds.forEach((productId) => {
      if (previousIds.has(productId) === nextIds.has(productId)) return;
      productListeners.get(productId)?.forEach((listener) => listener());
    });
  }

  return {
    getItems: () => items,
    isWishlisted: (productId) => items.includes(productId),
    toggleWishlist: (productId) => {
      setItems(
        items.includes(productId)
          ? items.filter((id) => id !== productId)
          : [...items, productId]
      );
    },
    setItems,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeToProduct: (productId, listener) => {
      const subscribers = productListeners.get(productId) ?? new Set<Listener>();
      subscribers.add(listener);
      productListeners.set(productId, subscribers);
      return () => {
        subscribers.delete(listener);
        if (subscribers.size === 0) productListeners.delete(productId);
      };
    },
  };
}