// Store global (Zustand + persist) para Etapas 0-2.
// Migra automáticamente desde las claves originales `gp_products` y `gp_sales`.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product, Sale } from "./types";

interface StoreState {
  products: Product[];
  sales: Sale[];
  // acciones
  addProduct: (p: Omit<Product, "id" | "history" | "createdAt">) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addSale: (s: Omit<Sale, "id">) => void;
  updateSale: (id: string, next: Sale) => void;
  deleteSale: (id: string) => void;
  replaceAll: (data: { products: Product[]; sales: Sale[] }) => void;
}

const STORAGE_KEY = "gestor-ventas:v1";
const LEGACY_FLAG = "gp_migrated_v1";

/**
 * Lee las claves antiguas (gp_products / gp_sales) UNA sola vez y las
 * inyecta como estado inicial. Idempotente vía flag.
 */
function loadLegacyIfNeeded(): { products: Product[]; sales: Sale[] } | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem(LEGACY_FLAG)) return null;
    // Si ya existe el store nuevo, no re-migramos.
    if (localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(LEGACY_FLAG, "1");
      return null;
    }
    const rawP = localStorage.getItem("gp_products");
    const rawS = localStorage.getItem("gp_sales");
    if (!rawP && !rawS) return null;
    const products: Product[] = rawP ? JSON.parse(rawP) : [];
    const sales: Sale[] = rawS ? JSON.parse(rawS) : [];
    // Normalizar campos que quizá no existían
    const normProducts = products.map((p) => ({
      history: [] as Product["history"],
      createdAt: new Date().toISOString(),
      controlStock: !!p.controlStock,
      stock: p.stock ?? 0,
      ...p,
    }));
    localStorage.setItem(LEGACY_FLAG, "1");
    return { products: normProducts, sales };
  } catch {
    return null;
  }
}

const legacy = loadLegacyIfNeeded();

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      products: legacy?.products ?? [],
      sales: legacy?.sales ?? [],

      addProduct: (p) =>
        set((s) => ({
          products: [
            ...s.products,
            {
              id: Date.now().toString(),
              history: [],
              createdAt: new Date().toISOString(),
              ...p,
            },
          ],
        })),

      updateProduct: (id, patch) =>
        set((s) => ({
          products: s.products.map((p) => {
            if (p.id !== id) return p;
            // Si cambió el costo, empujamos historial.
            const history = [...(p.history ?? [])];
            if (patch.cost !== undefined && patch.cost !== p.cost) {
              history.push({ cost: p.cost, date: new Date().toISOString() });
            }
            return { ...p, ...patch, history };
          }),
        })),

      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      addSale: (sale) =>
        set((s) => {
          // Descontar stock si corresponde
          const products = s.products.map((p) => {
            if (!p.controlStock) return p;
            const it = sale.items.find((i) => i.productId === p.id);
            if (!it) return p;
            return { ...p, stock: (p.stock ?? 0) - it.qty };
          });
          return {
            products,
            sales: [...s.sales, { id: Date.now().toString(), ...sale }],
          };
        }),

      updateSale: (id, next) =>
        set((s) => {
          const old = s.sales.find((x) => x.id === id);
          if (!old) return s;
          // Ajuste de stock: revertir viejo, aplicar nuevo
          const products = s.products.map((p) => {
            if (!p.controlStock) return p;
            const wasIn = old.items.find((i) => i.productId === p.id);
            const isIn = next.items.find((i) => i.productId === p.id);
            const delta = (wasIn?.qty ?? 0) - (isIn?.qty ?? 0);
            return delta === 0 ? p : { ...p, stock: (p.stock ?? 0) + delta };
          });
          return {
            products,
            sales: s.sales.map((x) => (x.id === id ? { ...next, id } : x)),
          };
        }),

      deleteSale: (id) =>
        set((s) => {
          const sale = s.sales.find((x) => x.id === id);
          if (!sale) return s;
          const products = s.products.map((p) => {
            if (!p.controlStock) return p;
            const it = sale.items.find((i) => i.productId === p.id);
            if (!it) return p;
            return { ...p, stock: (p.stock ?? 0) + it.qty };
          });
          return { products, sales: s.sales.filter((x) => x.id !== id) };
        }),

      replaceAll: ({ products, sales }) => set({ products, sales }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
