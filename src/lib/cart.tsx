import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./api";

export type CartItem = { id: string; name: string; price: number; quantity: number; stock: number };
type Ctx = { items: CartItem[]; add: (p: Product) => void; setQty: (id: string, q: number) => void; remove: (id: string) => void; clear: () => void; count: number; subtotal: number };
const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem("odb-cart") || "[]")); } catch { /* ignore */ }
  }, []);
  const save = (next: CartItem[]) => { setItems(next); localStorage.setItem("odb-cart", JSON.stringify(next)); };
  const add = (p: Product) => {
    const ex = items.find((i) => i.id === p.id);
    if (ex) save(items.map((i) => (i.id === p.id ? { ...i, quantity: Math.min(i.quantity + 1, p.stock) } : i)));
    else save([...items, { id: p.id, name: p.name, price: Number(p.price), quantity: 1, stock: p.stock }]);
  };
  const setQty = (id: string, q: number) => save(items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(q, i.stock)) } : i)));
  const remove = (id: string) => save(items.filter((i) => i.id !== id));
  return (
    <CartCtx.Provider value={{ items, add, setQty, remove, clear: () => save([]), count: items.reduce((s, i) => s + i.quantity, 0), subtotal: items.reduce((s, i) => s + i.price * i.quantity, 0) }}>
      {children}
    </CartCtx.Provider>
  );
}
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart fora do CartProvider");
  return c;
};
