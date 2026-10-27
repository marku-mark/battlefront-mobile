import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, AppState } from "react-native";
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
import { addWishlistProduct, getSessionRevision, getWishlist, removeWishlistProduct } from "@/lib/api";

type WishlistMode = "guest" | "customer";

type WishlistContextValue = {
  items: string[];
  isLoading: boolean;
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
  importGuestWishlist: () => Promise<number>;
  getGuestWishlist: () => string[];
};
const WishlistActionsContext = createContext<WishlistActions | null>(null);
const MOCK_WISHLIST_STORAGE_KEY = "battlefront-customer-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userKey = session.mode === "customer" ? session.user.id : "guest";
  const [store] = useState(createWishlistStore);
  const [isWishlistLoaded, setIsWishlistLoaded] = useState(false);
  const hydratedOwner = useRef<string | number | null>(null);
  const pendingMockToggles = useRef<string[]>([]);
  const mutationTail = useRef(Promise.resolve());
  const mutationVersion = useRef(0);
  const subscribe = useCallback(
    (listener: Listener) => store.subscribe(session.mode, listener),
    [session.mode, store]
  );
  const getSnapshot = useCallback(() => store.getItems(session.mode), [session.mode, store]);
  const productIds = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toggleWishlist = useCallback((productId: string) => {
    const wasSaved = store.isWishlisted(session.mode, productId);
    store.toggleWishlist(session.mode, productId);
    if (session.mode === "guest" && hydratedOwner.current !== userKey) pendingMockToggles.current.push(productId);
    if (session.mode === "customer") {
      const revision = getSessionRevision();
      const version = ++mutationVersion.current;
      mutationTail.current = mutationTail.current.then(async () => {
        if (revision !== getSessionRevision()) return;
        let failed = false;
        try { await (wasSaved ? removeWishlistProduct(productId) : addWishlistProduct(productId)); }
        catch { failed = true; }
        if (revision !== getSessionRevision() || version !== mutationVersion.current) return;
        try {
          const result = await getWishlist();
          if (revision === getSessionRevision() && version === mutationVersion.current) store.setItems("customer", result.items.map((item) => String(item.product_id)));
        } catch { if (failed && revision === getSessionRevision() && version === mutationVersion.current) store.toggleWishlist("customer", productId); }
        if (failed && revision === getSessionRevision()) Alert.alert("Could not update wishlist", "Your saved products have been refreshed. Please check the wishlist before trying again.");
      }).catch(() => undefined);
      return;
    }
  }, [session.mode, store, userKey]);
  useEffect(() => {
    if (session.mode !== "customer") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const revision = getSessionRevision(); const version = mutationVersion.current;
      void mutationTail.current.then(async () => {
        if (revision !== getSessionRevision()) return;
        const result = await getWishlist();
        if (revision === getSessionRevision() && version === mutationVersion.current) store.setItems("customer", result.items.map((item) => String(item.product_id)));
      }).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [session.mode, userKey, store]);
  const importGuestWishlist = useCallback(async () => {
    const guestItems = store.getItems("guest");
    if (guestItems.length === 0) return 0;
    const revision = getSessionRevision();
    const results = await Promise.allSettled(guestItems.map((productId) => addWishlistProduct(productId)));
    if (revision !== getSessionRevision()) return 0;
    const imported = guestItems.filter((_, index) => results[index]?.status === "fulfilled");
    store.setItems("customer", Array.from(new Set([...store.getItems("customer"), ...imported])));
    store.setItems("guest", store.getItems("guest").filter((productId) => !imported.includes(productId)));
    return imported.length;
  }, [store]);

  useEffect(() => {
    let active = true;
    const version = mutationVersion.current;
    store.setItems("customer", []);
    setIsWishlistLoaded(false);
    hydratedOwner.current = null;
    setIsWishlistLoaded(false);
    const localLoad = session.mode === "guest"
      ? AsyncStorage.getItem(MOCK_WISHLIST_STORAGE_KEY)
      : getWishlist().then((wishlist) => JSON.stringify(wishlist.items.map((item) => String(item.product_id))));
    localLoad
      .then((storedWishlist) => {
        if (!active) return;
        const parsedWishlist: unknown = storedWishlist ? JSON.parse(storedWishlist) : [];
        if (!Array.isArray(parsedWishlist) || !parsedWishlist.every((id) => typeof id === "string")) return;
        const storedIds = parsedWishlist as string[];
        const hydratedWishlist = pendingMockToggles.current.reduce((items, productId) => toggleId(items, productId), storedIds);
        pendingMockToggles.current = [];
        if (session.mode === "guest" || version === mutationVersion.current) store.setItems(session.mode, hydratedWishlist);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        setIsWishlistLoaded(true);
        hydratedOwner.current = userKey;
        setIsWishlistLoaded(true);
      });
    return () => { active = false; };
  }, [store, userKey]);

  useEffect(() => {
    if (!isWishlistLoaded || session.mode !== "guest" || hydratedOwner.current !== userKey) return;
    AsyncStorage.setItem(MOCK_WISHLIST_STORAGE_KEY, JSON.stringify(store.getItems("guest"))).catch(() => undefined);
  }, [isWishlistLoaded, productIds, session.mode, store, userKey]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items: productIds,
      isLoading: session.mode === "customer" && !isWishlistLoaded,
      isWishlisted: (productId) => store.isWishlisted(session.mode, productId),
      toggleWishlist,
    }),
    [isWishlistLoaded, productIds, session.mode, store, toggleWishlist]
  );
  const actions = useMemo<WishlistActions>(
    () => ({ toggleWishlist, importGuestWishlist, getGuestWishlist: () => store.getItems("guest") }),
    [importGuestWishlist, store, toggleWishlist]
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

export function useGuestWishlistImport() {
  const actions = useWishlistActionsContext();
  return { importGuestWishlist: actions.importGuestWishlist, getGuestWishlist: actions.getGuestWishlist };
}

export function useIsWishlisted(productId: string): boolean {
  const store = useWishlistStore();
  const { session } = useSession();
  const userKey = session.mode === "customer" ? session.user.id : "guest";
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
  let itemsByMode: Record<WishlistMode, string[]> = { guest: [], "customer": [] };
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
