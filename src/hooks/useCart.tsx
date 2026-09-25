import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import type { Product } from "@/lib/data";

export type CartItem = {
  product: Product;
  quantity: number;
  variant?: string | null;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number, variant?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variant?: string | null) => void;
  removeItem: (productId: string, variant?: string | null) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = "battlefront-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then((storedCart) => {
        if (!storedCart) return;
        const parsedCart = JSON.parse(storedCart) as CartItem[];
        if (Array.isArray(parsedCart)) {
          setItems(parsedCart.filter((item) => item?.product?.id && typeof item.product.price === "number" && typeof item.quantity === "number" && item.quantity > 0));
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => undefined);
  }, [items, isHydrated]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

    return {
      items,
      itemCount,
      subtotal,
      addItem: (product, quantity = 1, variant = null) => {
        setItems((current) => {
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
      updateQuantity: (productId, quantity, variant = null) => {
        setItems((current) =>
          quantity > 0
            ? current.map((item) =>
                item.product.id === productId && item.variant === variant ? { ...item, quantity } : item
              )
            : current.filter((item) => !(item.product.id === productId && item.variant === variant))
        );
      },
      removeItem: (productId, variant = null) => {
        setItems((current) => current.filter((item) => !(item.product.id === productId && item.variant === variant)));
      },
      clearCart: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
