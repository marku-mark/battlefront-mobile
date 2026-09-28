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
  const [isMockCartLoaded, setIsMockCartLoaded] = useState(false);
  const isMockCartLoadedRef = useRef(false);
  const pendingMockMutations = useRef<CartMutation[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(MOCK_CART_STORAGE_KEY)
      .then((storedCart) => {
        const parsedCart = storedCart ? JSON.parse(storedCart) as CartItem[] : [];
        const validCart = Array.isArray(parsedCart)
          ? parsedCart.filter((item) => item?.product?.id && typeof item.product.price === "number" && typeof item.quantity === "number" && item.quantity > 0)
          : [];
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
      if (session.mode === "mock-account" && !isMockCartLoadedRef.current) {
        pendingMockMutations.current.push(mutation);
      }
    }

    return {
      addItem: (product, quantity = 1, variant = null) => {
        applyMutation((current) => {
          const existing = current.find((item) => item.product.id === product.id && item.variant === variant);
          if (existing) {
            return current.map((item) =>
              item.product.id === product.id && item.variant === variant
                ? { ...item, quantity: item.quantity + quantity }
                : item
            );
          }
          return [...current, { product, quantity, variant }];
        });
      },
      updateQuantity: (productId, quantity, variant = null) => applyMutation((current) =>
        quantity > 0
          ? current.map((item) =>
              item.product.id === productId && item.variant === variant ? { ...item, quantity } : item
            )
          : current.filter((item) => !(item.product.id === productId && item.variant === variant))
      ),
      removeItem: (productId, variant = null) => applyMutation((current) => current.filter((item) => !(item.product.id === productId && item.variant === variant))),
      clearCart: () => applyMutation(() => []),
      promoteGuestCartToMock: () => {
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
      isLoading: session.mode === "mock-account" && !isMockCartLoaded,
    };
  }, [actions, isMockCartLoaded, items, session.mode]);

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

function mergeCartItems(existingItems: CartItem[], incomingItems: CartItem[]): CartItem[] {
  return incomingItems.reduce((mergedItems, incomingItem) => {
    const existingIndex = mergedItems.findIndex(
      (item) => item.product.id === incomingItem.product.id && item.variant === incomingItem.variant
    );
    if (existingIndex === -1) return [...mergedItems, incomingItem];

    return mergedItems.map((item, index) =>
      index === existingIndex ? { ...item, quantity: item.quantity + incomingItem.quantity } : item
    );
  }, existingItems);
}
