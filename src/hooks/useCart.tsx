import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import type { Product } from "@/lib/data";
import { addCartItem, changeCartItem, deleteCartItem, getCart, type ApiCart } from "@/lib/api";
import { createOptimisticCart, createCartQueue, type CartItem } from "@/lib/cartState";
import { useSession } from "@/hooks/useSession";
import { createPendingActions } from "@/lib/pendingActions";

export type { CartItem } from "@/lib/cartState";
type CartActions = { addItem: (product: Product, quantity?: number, variant?: string | null) => Promise<boolean>; updateQuantity: (id: string, quantity: number, variant?: string | null) => Promise<boolean>; removeItem: (id: string, variant?: string | null) => Promise<boolean>; clearCart: () => Promise<boolean>; refreshCart: (force?: boolean) => Promise<void>; promoteGuestCartToMock: () => void };
type CartValue = CartActions & { items: CartItem[]; itemCount: number; subtotal: number; isLoading: boolean; isUpdating: boolean; error: string | null; conflictCount: number };
const CartActionsContext = createContext<CartActions | null>(null);
const CartContext = createContext<CartValue | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const identity = session.mode === "customer" ? session.user.id : null;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const enqueue = useRef(createCartQueue()).current;
  const optimistic = useRef(createOptimisticCart());
  const pendingAdds = useRef(createPendingActions<boolean>()).current;
  const pendingRefresh = useRef(createPendingActions<void>()).current;
  function publish() {
    const snapshot = optimistic.current.snapshot();
    setItems(snapshot.items); setSubtotal(snapshot.subtotal); setConflictCount(snapshot.conflictCount);
  }
  function apply(cart: ApiCart, owner: number | null) {
    if (identityRef.current !== owner) return;
    optimistic.current.confirm(cart);
    publish(); setError(null);
  }
  async function refreshCart(force = true) {
    if (identity === null) return;
    const owner = identity;
    setPendingUpdates((count) => count + 1);
    try {
      await enqueue(async () => {
        if (identityRef.current !== owner) return;
        apply(await getCart(force), owner);
      });
    } catch (reason) {
      if (identityRef.current === owner) setError(reason instanceof Error ? reason.message : "Cannot load cart.");
      throw reason;
    } finally { if (identityRef.current === owner) setPendingUpdates((count) => Math.max(0, count - 1)); }
  }
  useEffect(() => {
    optimistic.current = createOptimisticCart();
    setItems([]); setSubtotal(0); setConflictCount(0); setError(null); setPendingUpdates(0);
    if (identity === null) { setIsLoading(false); return; }
    let active = true;
    setIsLoading(true);
    enqueue(async () => {
      if (!active) return;
      const cart = await getCart();
      if (active) apply(cart, identity);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Cannot load cart."); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [identity]);
  function mutate(action: () => Promise<ApiCart>, change?: { productId: string; quantity: number }): Promise<boolean> {
    if (identityRef.current !== identity) return Promise.resolve(false);
    if (identity === null) { Alert.alert("Sign in required", "Sign in from Account before adding products to your cart."); return Promise.resolve(false); }
    const owner = identity;
    const state = optimistic.current;
    const operation = change ? state.begin(change.productId, change.quantity) : null;
    publish();
    setPendingUpdates((count) => count + 1);
    const result = enqueue(async () => {
      if (identityRef.current !== owner || optimistic.current !== state) return false;
      try {
        const cart = await action();
        if (identityRef.current !== owner || optimistic.current !== state) return false;
        if (operation) state.settle(operation);
        apply(cart, owner);
        return true;
      }
      catch (reason) {
        if (identityRef.current === owner && optimistic.current === state) {
          if (operation) state.settle(operation);
          publish();
          try {
            const cart = await getCart(true);
            if (identityRef.current !== owner || optimistic.current !== state) return false;
            apply(cart, owner);
          } catch { /* Keep checkout blocked until the cart can be reconciled. */ }
          if (identityRef.current !== owner || optimistic.current !== state) return false;
          const message = reason instanceof Error ? reason.message : "Please try again.";
          setError(`${message}\nPull down to refresh your cart before checking out.`);
          Alert.alert("Cart update failed", message);
        }
        return false;
      }
    }).finally(() => { if (identityRef.current === owner && optimistic.current === state) setPendingUpdates((count) => Math.max(0, count - 1)); });
    return result;
  }
  const value: CartValue = {
    items, subtotal, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), isLoading, isUpdating: pendingUpdates > 0, error, conflictCount, refreshCart,
    addItem: (product, quantity = 1) => pendingAdds.run(`${identity}:${product.id}`, () => mutate(() => addCartItem(product.id, quantity))),
    updateQuantity: (id, quantity) => mutate(async () => {
      const item = optimistic.current.find(id);
      if (!item?.serverId) throw new Error("Refresh the cart and try again.");
      return quantity <= 0 ? deleteCartItem(item.serverId) : changeCartItem(item.serverId, quantity);
    }, { productId: id, quantity }),
    removeItem: (id) => mutate(async () => {
      const item = optimistic.current.find(id);
      if (!item?.serverId) throw new Error("Refresh the cart and try again.");
      return deleteCartItem(item.serverId);
    }, { productId: id, quantity: 0 }),
    clearCart: () => mutate(async () => {
      let cart = await getCart();
      for (const row of cart.items) {
        cart = await deleteCartItem(row.id);
        apply(cart, identity);
      }
      return cart;
    }),
    promoteGuestCartToMock: () => {},
  };
  const currentActions = useRef<CartActions>(value);
  currentActions.current = value;
  const actions = useMemo<CartActions>(() => ({
    addItem: (...args) => currentActions.current.addItem(...args),
    updateQuantity: (...args) => currentActions.current.updateQuantity(...args),
    removeItem: (...args) => currentActions.current.removeItem(...args),
    clearCart: () => currentActions.current.clearCart(),
    refreshCart: (force) => pendingRefresh.run(String(identityRef.current), () => currentActions.current.refreshCart(force)),
    promoteGuestCartToMock: () => currentActions.current.promoteGuestCartToMock(),
  }), []);
  return <CartActionsContext.Provider value={actions}><CartContext.Provider value={value}>{children}</CartContext.Provider></CartActionsContext.Provider>;
}
export function useCart() { const context = useContext(CartContext); if (!context) throw new Error("useCart must be used inside CartProvider"); return context; }
export function useCartActions(): CartActions { const actions = useContext(CartActionsContext); if (!actions) throw new Error("useCartActions must be used inside CartProvider"); return actions; }
