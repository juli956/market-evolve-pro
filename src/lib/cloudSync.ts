// Capa de sincronización con Lovable Cloud.
// - pullAll(userId): trae productos + ventas del servidor y los mete en el store local.
// - pushProduct / deleteProduct / pushSale / deleteSale: empujan cambios fire-and-forget.
// Usa un flag `applyingRemote` para que las mutaciones locales causadas por
// un pull no vuelvan a rebotar al servidor.

import { supabase } from "@/integrations/supabase/client";
import type { Product, Sale, Client, Provider } from "./types";
import { useStore } from "./store";
import { toast } from "sonner";

let currentUserId: string | null = null;
let applyingRemote = false;

export function getSyncUserId() {
  return currentUserId;
}

export function isApplyingRemote() {
  return applyingRemote;
}

export function setSyncUser(id: string | null) {
  currentUserId = id;
}

// ---------- Mapeo DB <-> local ----------

type ProductRow = {
  id: string;
  name: string;
  provider: string | null;
  cost: number;
  stock: number;
  control_stock: boolean;
  history: unknown;
  created_at: string;
  stock_type: string | null;
  production_config: unknown;
};

type SaleRow = {
  id: string;
  client: string | null;
  date: string;
  items: unknown;
  total: number;
  profit: number;
  notes: string | null;
  payment_method: string | null;
};

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    provider: r.provider ?? undefined,
    cost: Number(r.cost),
    stock: r.stock,
    controlStock: r.control_stock,
    history: Array.isArray(r.history) ? (r.history as Product["history"]) : [],
    createdAt: r.created_at,
    stockType: (r.stock_type as Product["stockType"]) ?? "simple",
    productionConfig: (r.production_config as Product["productionConfig"]) ?? undefined,
  };
}

function productToRow(p: Product) {
  return {
    id: p.id,
    user_id: currentUserId!,
    name: p.name,
    provider: p.provider ?? null,
    cost: p.cost,
    stock: p.stock,
    control_stock: p.controlStock,
    history: p.history ?? [],
    created_at: p.createdAt,
    stock_type: p.stockType ?? "simple",
    production_config: p.productionConfig ?? null,
  };
}

function rowToSale(r: SaleRow): Sale {
  return {
    id: r.id,
    client: r.client ?? "",
    date: r.date,
    items: (Array.isArray(r.items) ? r.items : []) as Sale["items"],
    total: Number(r.total),
    profit: Number(r.profit),
    notes: r.notes ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
  };
}

function saleToRow(s: Sale) {
  return {
    id: s.id,
    user_id: currentUserId!,
    client: s.client || null,
    date: s.date,
    items: s.items,
    total: s.total,
    profit: s.profit,
    notes: s.notes ?? null,
    payment_method: s.paymentMethod ?? null,
  };
}

// Convierte los IDs locales (Date.now().toString()) a UUID válido.
// Si ya parece UUID lo deja; si no, genera uno nuevo determinístico via crypto.
function ensureUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;
  return crypto.randomUUID();
}

// ---------- Pull ----------

type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};
function rowToContact(r: ContactRow): Client {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}
function contactToRow(c: Client) {
  return {
    id: c.id,
    user_id: currentUserId!,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    notes: c.notes ?? null,
    created_at: c.createdAt,
  };
}

export async function pullAll(userId: string) {
  currentUserId = userId;
  const [
    { data: prods, error: eP },
    { data: sales, error: eS },
    { data: clients, error: eC },
    { data: providers, error: eV },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("user_id", userId),
    supabase.from("sales").select("*").eq("user_id", userId),
    supabase.from("clients").select("*").eq("user_id", userId),
    supabase.from("providers").select("*").eq("user_id", userId),
  ]);
  if (eP || eS || eC || eV) {
    toast.error("No se pudieron leer los datos de la nube");
    return;
  }
  applyingRemote = true;
  try {
    useStore.getState().replaceAll({
      products: (prods ?? []).map((r) => rowToProduct(r as ProductRow)),
      sales: (sales ?? []).map((r) => rowToSale(r as SaleRow)),
      clients: (clients ?? []).map((r) => rowToContact(r as ContactRow)),
      providers: (providers ?? []).map((r) => rowToContact(r as ContactRow)),
    });
  } finally {
    applyingRemote = false;
  }
}

// Sube todo lo local a la nube (útil tras primer login para preservar datos previos).
export async function pushAllLocal(userId: string) {
  currentUserId = userId;
  const { products, sales } = useStore.getState();
  if (products.length === 0 && sales.length === 0) return;

  // Reasignar IDs no-uuid antes de subir.
  const idMap = new Map<string, string>();
  const fixedProducts = products.map((p) => {
    const nid = ensureUuid(p.id);
    idMap.set(p.id, nid);
    return { ...p, id: nid };
  });
  const fixedSales = sales.map((s) => ({
    ...s,
    id: ensureUuid(s.id),
    items: s.items.map((it) => ({ ...it, productId: idMap.get(it.productId) ?? it.productId })),
  }));

  applyingRemote = true;
  useStore.getState().replaceAll({ products: fixedProducts, sales: fixedSales });
  applyingRemote = false;

  const { error: e1 } = await supabase
    .from("products")
    .upsert(fixedProducts.map(productToRow) as never);
  const { error: e2 } = await supabase
    .from("sales")
    .upsert(fixedSales.map(saleToRow) as never);
  if (e1 || e2) toast.error("No se pudieron subir todos los datos locales");
}

// ---------- Push ----------

export function pushProduct(p: Product) {
  if (!currentUserId || applyingRemote) return;
  supabase
    .from("products")
    .upsert(productToRow(p) as never)
    .then(({ error }) => {
      if (error) toast.error("Error al guardar producto: " + error.message);
    });
}

export function deleteProductRemote(id: string) {
  if (!currentUserId || applyingRemote) return;
  supabase
    .from("products")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) toast.error("Error al eliminar producto: " + error.message);
    });
}

export function pushSale(s: Sale) {
  if (!currentUserId || applyingRemote) return;
  supabase
    .from("sales")
    .upsert(saleToRow(s) as never)
    .then(({ error }) => {
      if (error) toast.error("Error al guardar venta: " + error.message);
    });
}

export function deleteSaleRemote(id: string) {
  if (!currentUserId || applyingRemote) return;
  supabase
    .from("sales")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) toast.error("Error al eliminar venta: " + error.message);
    });
}


export function pushClient(c: Client) {
  if (!currentUserId || applyingRemote) return;
  supabase.from("clients").upsert(contactToRow(c) as never).then(({ error }) => {
    if (error) toast.error("Error al guardar cliente: " + error.message);
  });
}
export function deleteClientRemote(id: string) {
  if (!currentUserId || applyingRemote) return;
  supabase.from("clients").delete().eq("id", id).then(({ error }) => {
    if (error) toast.error("Error al eliminar cliente: " + error.message);
  });
}
export function pushProvider(p: Provider) {
  if (!currentUserId || applyingRemote) return;
  supabase.from("providers").upsert(contactToRow(p) as never).then(({ error }) => {
    if (error) toast.error("Error al guardar proveedor: " + error.message);
  });
}
export function deleteProviderRemote(id: string) {
  if (!currentUserId || applyingRemote) return;
  supabase.from("providers").delete().eq("id", id).then(({ error }) => {
    if (error) toast.error("Error al eliminar proveedor: " + error.message);
  });
}
