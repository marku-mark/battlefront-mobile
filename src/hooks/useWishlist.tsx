import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "@/hooks/useSession";

type WishlistMode = "guest" | "mock-account";

type WishlistContextValue = {
  items: string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
type Listener = () => void;

type WishlistStore = {
  getItems: (mode: WishlistMode) => string[];
  isWishlisted: (mode: WishlistMode, productId: string) => boolean;
  toggleWishlist: (mode: WishlistMode, productId: string) => void;
  setItems: (mode: WishlistMode, items: string[]) => void;
  subscribe: (mode: WishlistMode, listener: Listener) => () => void;
  subscribeToProduct: (mode: WishlistMode, productId: string, listener: Listener) => () => void;
};

const WishlistStoreContext = createContext<WishlistStore | null>(null);
type WishlistActions = {
  toggleWishlist: (productId: string) => void;
  promoteGuestWishlistToMock: () => void;
};
const WishlistActionsContext = createContext<WishlistActions | null>(null);
const MOCK_WISHLIST_STORAGE_KEY = "battlefront-mock-account-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [store] = useState(createWishlistStore);
  const [isMockWishlistLoaded, setIsMockWishlistLoaded] = useState(false);
  const isMockWishlistLoadedRef = useRef(false);
  const pendingMockToggles = useRef<string[]>([]);
  const pendingGuestItems = useRef<string[]>([]);
  const subscribe = useCallback(
    (listener: Listener) => store.subscribe(session.mode, listener),
    [session.mode, store]
  );
  const getSnapshot = useCallback(() => store.getItems(session.mode), [session.mode, store]);
  const productIds = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toggleWishlist = useCallback((productId: string) => {
    store.toggleWishlist(session.mode, productId);
    if (session.mode === "mock-account" && !isMockWishlistLoadedRef.current) {
      pendingMockToggles.current.push(productId);
    }
  }, [session.mode, store]);
  const promoteGuestWishlistToMock = useCallback(() => {
    const guestItems = store.getItems("guest");
    if (guestItems.length === 0) return;

    if (!isMockWishlistLoadedRef.current) pendingGuestItems.current.push(...guestItems);
    store.setItems("mock-account", Array.from(new Set([...store.getItems("mock-account"), ...guestItems])));
    store.setItems("guest", []);
  }, [store]);

  useEffect(() => {
    AsyncStorage.getItem(MOCK_WISHLIST_STORAGE_KEY)
      .then((storedWishlist) => {
        const parsedWishlist: unknown = storedWishlist ? JSON.parse(storedWishlist) : [];
        if (!Array.isArray(parsedWishlist) || !parsedWishlist.every((id) => typeof id === "string")) return;
        const storedIds = parsedWishlist as string[];
        const withGuestItems = Array.from(new Set([...storedIds, ...pendingGuestItems.current]));
        const hydratedWishlist = pendingMockToggles.current.reduce((items, productId) => toggleId(items, productId), withGuestItems);
        pendingGuestItems.current = [];
        pendingMockToggles.current = [];
        store.setItems("mock-account", hydratedWishlist);
      })
      .catch(() => undefined)
      .finally(() => {
        isMockWishlistLoadedRef.current = true;
        setIsMockWishlistLoaded(true);
      });
  }, [store]);

  useEffect(() => {
    if (!isMockWishlistLoaded || session.mode !== "mock-account") return;
    AsyncStorage.setItem(MOCK_WISHLIST_STORAGE_KEY, JSON.stringify(store.getItems("mock-account"))).catch(() => undefined);
  }, [isMockWishlistLoaded, productIds, session.mode, store]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items: productIds,
      isWishlisted: (productId) => store.isWishlisted(session.mode, productId),
      toggleWishlist,
    }),
    [productIds, session.mode, store, toggleWishlist]
  );
  const actions = useMemo<WishlistActions>(
    () => ({ toggleWishlist, promoteGuestWishlistToMock }),
    [promoteGuestWishlistToMock, toggleWishlist]
  );

  return (
    <WishlistStoreContext.Provider value={store}>
      <WishlistActionsContext.Provider value={actions}>
        <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
      </WishlistActionsContext.Provider>
    </WishlistStoreContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}

export function useWishlistActions(): (productId: string) => void {
  return useWishlistActionsContext().toggleWishlist;
}

export function usePromoteGuestWishlistToMock(): () => void {
  return useWishlistActionsContext().promoteGuestWishlistToMock;
}

export function useIsWishlisted(productId: string): boolean {
  const store = useWishlistStore();
  const { session } = useSession();
  const subscribe = useCallback(
    (listener: Listener) => store.subscribeToProduct(session.mode, productId, listener),
    [productId, session.mode, store]
  );
  const getSnapshot = useCallback(() => store.isWishlisted(session.mode, productId), [productId, session.mode, store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useWishlistStore(): WishlistStore {
  const store = useContext(WishlistStoreContext);
  if (!store) throw new Error("Wishlist hooks must be used inside WishlistProvider");
  return store;
}

function createWishlistStore(): WishlistStore {
  let itemsByMode: Record<WishlistMode, string[]> = { guest: [], "mock-account": [] };
  const listeners = new Map<WishlistMode, Set<Listener>>();
  const productListeners = new Map<WishlistMode, Map<string, Set<Listener>>>();

  function setItems(mode: WishlistMode, nextItems: string[]) {
    const items = itemsByMode[mode];
    if (items === nextItems) return;

    const previousIds = new Set(items);
    const nextIds = new Set(nextItems);
    const changedIds = new Set([...previousIds, ...nextIds]);
    itemsByMode = { ...itemsByMode, [mode]: nextItems };
    listeners.get(mode)?.forEach((listener) => listener());

    changedIds.forEach((productId) => {
      if (previousIds.has(productId) === nextIds.has(productId)) return;
      productListeners.get(mode)?.get(productId)?.forEach((listener) => listener());
    });
  }

  return {
    getItems: (mode) => itemsByMode[mode],
    isWishlisted: (mode, productId) => itemsByMode[mode].includes(productId),
    toggleWishlist: (mode, productId) => {
      setItems(mode, toggleId(itemsByMode[mode], productId));
    },
    setItems,
    subscribe: (mode, listener) => {
      const subscribers = listeners.get(mode) ?? new Set<Listener>();
      subscribers.add(listener);
      listeners.set(mode, subscribers);
      return () => {
        subscribers.delete(listener);
        if (subscribers.size === 0) listeners.delete(mode);
      };
    },
    subscribeToProduct: (mode, productId, listener) => {
      const modeListeners = productListeners.get(mode) ?? new Map<string, Set<Listener>>();
      const subscribers = modeListeners.get(productId) ?? new Set<Listener>();
      subscribers.add(listener);
      modeListeners.set(productId, subscribers);
      productListeners.set(mode, modeListeners);
      return () => {
        subscribers.delete(listener);
        if (subscribers.size === 0) modeListeners.delete(productId);
        if (modeListeners.size === 0) productListeners.delete(mode);
      };
    },
  };
}

function toggleId(items: string[], productId: string): string[] {
  return items.includes(productId)
    ? items.filter((id) => id !== productId)
    : [...items, productId];
}

function useWishlistActionsContext(): WishlistActions {
  const actions = useContext(WishlistActionsContext);
  if (!actions) throw new Error("Wishlist actions must be used inside WishlistProvider");
  return actions;
}