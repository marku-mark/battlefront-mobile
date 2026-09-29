import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import type { Product } from "@/lib/data";
import { useSession } from "@/hooks/useSession";

export type CartItem = {
  product: Product;
  quantity: number;
  variant?: string | null;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isLoading: boolean;
} & CartActions;

type CartActions = {
  addItem: (product: Product, quantity?: number, variant?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variant?: string | null) => void;
  removeItem: (productId: string, variant?: string | null) => void;
  clearCart: () => void;
  promoteGuestCartToMock: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CartActionsContext = createContext<CartActions | null>(null);
const GUEST_CART_STORAGE_KEY = "battlefront-guest-cart";
const MOCK_CART_STORAGE_KEY = "battlefront-mock-account-cart";
type CartMode = "guest" | "mock-account";
type CartMutation = (items: CartItem[]) => CartItem[];

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [itemsByMode, setItemsByMode] = useState<Record<CartMode, CartItem[]>>({
    guest: [],
    "mock-account": [],
  });
  const itemsByModeRef = useRef(itemsByMode);
  itemsByModeRef.current = itemsByMode;
  const [isGuestCartLoaded, setIsGuestCartLoaded] = useState(false);
  const [isMockCartLoaded, setIsMockCartLoaded] = useState(false);
  const isGuestCartLoadedRef = useRef(false);
  const isMockCartLoadedRef = useRef(false);
  const pendingGuestMutations = useRef<CartMutation[]>([]);
  const pendingMockMutations = useRef<CartMutation[]>([]);
  const pendingGuestPromotion = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(GUEST_CART_STORAGE_KEY)
      .then((storedCart) => {
        const validCart = parseStoredCart(storedCart);
        const hydratedCart = pendingGuestMutations.current.reduce((items, mutation) => mutation(items), validCart);
        pendingGuestMutations.current = [];
        const shouldPromote = pendingGuestPromotion.current;
        pendingGuestPromotion.current = false;
        if (shouldPromote && hydratedCart.length > 0 && !isMockCartLoadedRef.current) {
          pendingMockMutations.current.push((mockItems) => mergeCartItems(mockItems, hydratedCart));
        }
        setItemsByMode((current) => shouldPromote
          ? {
              guest: [],
              "mock-account": mergeCartItems(current["mock-account"], hydratedCart),
            }
          : { ...current, guest: hydratedCart });
      })
      .catch(() => undefined)
      .finally(() => {
        isGuestCartLoadedRef.current = true;
        setIsGuestCartLoaded(true);
      });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(MOCK_CART_STORAGE_KEY)
      .then((storedCart) => {
        const validCart = parseStoredCart(storedCart);
        const hydratedCart = pendingMockMutations.current.reduce((items, mutation) => mutation(items), validCart);
        pendingMockMutations.current = [];
        setItemsByMode((current) => ({ ...current, "mock-account": hydratedCart }));
      })
      .catch(() => undefined)
      .finally(() => {
        isMockCartLoadedRef.current = true;
        setIsMockCartLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!isGuestCartLoaded) return;
    AsyncStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(itemsByMode.guest)).catch(() => undefined);
  }, [isGuestCartLoaded, itemsByMode.guest]);

  useEffect(() => {
    if (!isMockCartLoaded) return;
    AsyncStorage.setItem(MOCK_CART_STORAGE_KEY, JSON.stringify(itemsByMode["mock-account"])).catch(() => undefined);
  }, [isMockCartLoaded, itemsByMode["mock-account"]]);

  const items = itemsByMode[session.mode];

  const actions = useMemo<CartActions>(() => {
    function applyMutation(mutation: CartMutation) {
      setItemsByMode((current) => ({
        ...current,
        [session.mode]: mutation(current[session.mode]),
      }));
      if (session.mode === "guest" && !isGuestCartLoadedRef.current) {
        pendingGuestMutations.current.push(mutation);
      }
      if (session.mode === "mock-account" && !isMockCartLoadedRef.current) {
        pendingMockMutations.current.push(mutation);
      }
    }

    return {
      addItem: (product, quantity = 1, variant = null) => {
        applyMutation((current) => {
          const stockLimit = getStockLimit(product);
          const requestedQuantity = Math.max(0, Math.floor(quantity));
          if (stockLimit === 0 || requestedQuantity === 0) return current;
          const existing = current.find((item) => item.product.id === product.id && item.variant === variant);
          if (existing) {
            return current.map((item) =>
              item.product.id === product.id && item.variant === variant
                ? { ...item, quantity: clampQuantity(product, item.quantity + requestedQuantity) }
                : item
            );
          }
          return [...current, { product, quantity: clampQuantity(product, requestedQuantity), variant }];
        });
      },
      updateQuantity: (productId, quantity, variant = null) => applyMutation((current) => {
        if (quantity <= 0) {
          return current.filter((item) => !(item.product.id === productId && item.variant === variant));
        }

        return current.flatMap((item) => {
          if (item.product.id !== productId || item.variant !== variant) return [item];
          const safeQuantity = clampQuantity(item.product, quantity);
          return safeQuantity > 0 ? [{ ...item, quantity: safeQuantity }] : [];
        });
      }),
      removeItem: (productId, variant = null) => applyMutation((current) => current.filter((item) => !(item.product.id === productId && item.variant === variant))),
      clearCart: () => applyMutation(() => []),
      promoteGuestCartToMock: () => {
        if (!isGuestCartLoadedRef.current) {
          pendingGuestPromotion.current = true;
          return;
        }

        const guestItems = itemsByModeRef.current.guest;
        if (guestItems.length === 0) return;

        if (!isMockCartLoadedRef.current) {
          pendingMockMutations.current.push((mockItems) => mergeCartItems(mockItems, guestItems));
        }
        setItemsByMode((current) => ({
          ...current,
          guest: [],
          "mock-account": mergeCartItems(current["mock-account"], guestItems),
        }));
      },
    };
  }, [session.mode]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

    return {
      ...actions,
      items,
      itemCount,
      subtotal,
      isLoading: session.mode === "guest" ? !isGuestCartLoaded : !isMockCartLoaded,
    };
  }, [actions, isGuestCartLoaded, isMockCartLoaded, items, session.mode]);

  return (
    <CartActionsContext.Provider value={actions}>
      <CartContext.Provider value={value}>{children}</CartContext.Provider>
    </CartActionsContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}

export function useCartActions(): CartActions {
  const context = useContext(CartActionsContext);
  if (!context) {
    throw new Error("useCartActions must be used inside CartProvider");
  }
  return context;
}

function parseStoredCart(storedCart: string | null): CartItem[] {
  if (!storedCart) return [];
  try {
    const parsed: unknown = JSON.parse(storedCart);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CartItem => {
        if (!item || typeof item !== "object") return false;
        const cartItem = item as Partial<CartItem>;
        return Boolean(cartItem.product?.id)
          && typeof cartItem.product?.price === "number"
          && typeof cartItem.quantity === "number"
          && cartItem.quantity > 0;
      })
      .map((item) => ({
        ...item,
        variant: item.variant ?? null,
        quantity: clampQuantity(item.product, item.quantity),
      }))
      .filter((item) => item.quantity > 0);
  } catch {
    return [];
  }
}

function mergeCartItems(existingItems: CartItem[], incomingItems: CartItem[]): CartItem[] {
  return incomingItems.reduce((mergedItems, incomingItem) => {
    const stockLimit = getStockLimit(incomingItem.product);
    const incomingQuantity = clampQuantity(incomingItem.product, incomingItem.quantity);
    if (stockLimit === 0 || incomingQuantity === 0) return mergedItems;
    const existingIndex = mergedItems.findIndex(
      (item) => item.product.id === incomingItem.product.id && item.variant === incomingItem.variant
    );
    if (existingIndex === -1) {
      return [...mergedItems, { ...incomingItem, quantity: incomingQuantity }];
    }

    return mergedItems.map((item, index) =>
      index === existingIndex
        ? { ...item, quantity: clampQuantity(incomingItem.product, item.quantity + incomingQuantity) }
        : item
    );
  }, existingItems);
}

function getStockLimit(product: Product): number {
  return Math.max(0, Math.floor(product.stockQuantity ?? 12));
}

function clampQuantity(product: Product, quantity: number): number {
  return Math.min(getStockLimit(product), Math.max(0, Math.floor(quantity)));
}
