// Store global (Zustand + persist) para Etapas 0-2.
// Migra automáticamente desde las claves originales `gp_products` y `gp_sales`.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product, Sale, Client, Provider } from "./types";

interface StoreState {
  products: Product[];
  sales: Sale[];
  clients: Client[];
  providers: Provider[];
  // acciones
  addProduct: (p: Omit<Product, "id" | "history" | "createdAt">) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addSale: (s: Omit<Sale, "id">) => void;
  updateSale: (id: string, next: Sale) => void;
  deleteSale: (id: string) => void;
  addClient: (c: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addProvider: (p: Omit<Provider, "id" | "createdAt">) => void;
  updateProvider: (id: string, patch: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  replaceAll: (data: {
    products: Product[];
    sales: Sale[];
    clients?: Client[];
    providers?: Provider[];
  }) => void;
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
      ...p,
      history: p.history ?? [],
      createdAt: p.createdAt ?? new Date().toISOString(),
      controlStock: !!p.controlStock,
      stock: p.stock ?? 0,
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
      clients: [],
      providers: [],

      addProduct: (p) =>
        set((s) => {
          const created: Product = {
            id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
            history: [],
            createdAt: new Date().toISOString(),
            ...p,
          };
          import("./cloudSync").then((m) => m.pushProduct(created));
          return { products: [...s.products, created] };
        }),

      updateProduct: (id, patch) =>
        set((s) => {
          let updated: Product | null = null;
          const products = s.products.map((p) => {
            if (p.id !== id) return p;
            const history = [...(p.history ?? [])];
            if (patch.cost !== undefined && patch.cost !== p.cost) {
              history.push({ cost: p.cost, date: new Date().toISOString() });
            }
            updated = { ...p, ...patch, history };
            return updated;
          });
          if (updated) import("./cloudSync").then((m) => m.pushProduct(updated!));
          return { products };
        }),

      deleteProduct: (id) =>
        set((s) => {
          import("./cloudSync").then((m) => m.deleteProductRemote(id));
          return { products: s.products.filter((p) => p.id !== id) };
        }),

      addSale: (sale) =>
        set((s) => {
          const products = s.products.map((p) => {
            if (!p.controlStock) return p;
            const it = sale.items.find((i) => i.productId === p.id);
            if (!it) return p;
            return { ...p, stock: (p.stock ?? 0) - it.qty };
          });
          const created: Sale = {
            id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
            ...sale,
          };
          import("./cloudSync").then((m) => {
            m.pushSale(created);
            // Also push any products whose stock changed
            products.forEach((p, i) => {
              if (p !== s.products[i]) m.pushProduct(p);
            });
          });
          return { products, sales: [...s.sales, created] };
        }),

      updateSale: (id, next) =>
        set((s) => {
          const old = s.sales.find((x) => x.id === id);
          if (!old) return s;
          const products = s.products.map((p) => {
            if (!p.controlStock) return p;
            const wasIn = old.items.find((i) => i.productId === p.id);
            const isIn = next.items.find((i) => i.productId === p.id);
            const delta = (wasIn?.qty ?? 0) - (isIn?.qty ?? 0);
            return delta === 0 ? p : { ...p, stock: (p.stock ?? 0) + delta };
          });
          const merged = { ...next, id };
          import("./cloudSync").then((m) => {
            m.pushSale(merged);
            products.forEach((p, i) => {
              if (p !== s.products[i]) m.pushProduct(p);
            });
          });
          return {
            products,
            sales: s.sales.map((x) => (x.id === id ? merged : x)),
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
          import("./cloudSync").then((m) => {
            m.deleteSaleRemote(id);
            products.forEach((p, i) => {
              if (p !== s.products[i]) m.pushProduct(p);
            });
          });
          return { products, sales: s.sales.filter((x) => x.id !== id) };
        }),

      addClient: (c) =>
        set((s) => {
          const created: Client = {
            id: crypto.randomUUID?.() ?? Date.now().toString(),
            createdAt: new Date().toISOString(),
            ...c,
          };
          import("./cloudSync").then((m) => m.pushClient(created));
          return { clients: [...s.clients, created] };
        }),
      updateClient: (id, patch) =>
        set((s) => {
          let updated: Client | null = null;
          const clients = s.clients.map((c) => {
            if (c.id !== id) return c;
            updated = { ...c, ...patch };
            return updated;
          });
          if (updated) import("./cloudSync").then((m) => m.pushClient(updated!));
          return { clients };
        }),
      deleteClient: (id) =>
        set((s) => {
          import("./cloudSync").then((m) => m.deleteClientRemote(id));
          return { clients: s.clients.filter((c) => c.id !== id) };
        }),
      addProvider: (p) =>
        set((s) => {
          const created: Provider = {
            id: crypto.randomUUID?.() ?? Date.now().toString(),
            createdAt: new Date().toISOString(),
            ...p,
          };
          import("./cloudSync").then((m) => m.pushProvider(created));
          return { providers: [...s.providers, created] };
        }),
      updateProvider: (id, patch) =>
        set((s) => {
          let updated: Provider | null = null;
          const providers = s.providers.map((p) => {
            if (p.id !== id) return p;
            updated = { ...p, ...patch };
            return updated;
          });
          if (updated) import("./cloudSync").then((m) => m.pushProvider(updated!));
          return { providers };
        }),
      deleteProvider: (id) =>
        set((s) => {
          import("./cloudSync").then((m) => m.deleteProviderRemote(id));
          return { providers: s.providers.filter((p) => p.id !== id) };
        }),

      replaceAll: ({ products, sales, clients, providers }) =>
        set((s) => ({
          products,
          sales,
          clients: clients ?? s.clients,
          providers: providers ?? s.providers,
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

