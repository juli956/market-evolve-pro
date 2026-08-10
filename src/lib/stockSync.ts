// Sincronización del módulo de Stock (bobinas, producciones, lotes, tubos, config)
// con la nube. Se guarda como un único documento JSON por usuario y gana el
// dispositivo con la marca de tiempo más reciente.

import { supabase } from "@/integrations/supabase/client";
import { useStockStore } from "./stock-store";
import { toast } from "sonner";

const LOCAL_TS = "gestor-ventas:stock:updatedAt";

let userId: string | null = null;
let applyingRemote = false;
let subscribed = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function snapshot() {
  const s = useStockStore.getState();
  return {
    tubes: s.tubes,
    purchases: s.purchases,
    productions: s.productions,
    finishedLots: s.finishedLots,
    settings: s.settings,
  };
}

function localTs(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(LOCAL_TS) ?? "";
}

function setLocalTs(ts: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(LOCAL_TS, ts);
}

export async function pushStockNow(silent = true) {
  if (!userId) return;
  const ts = new Date().toISOString();
  const { error } = await supabase
    .from("stock_state")
    .upsert({ user_id: userId, data: snapshot() as never, updated_at: ts } as never);
  if (error) {
    if (!silent) toast.error("No se pudo subir el stock: " + error.message);
    return;
  }
  setLocalTs(ts);
  if (!silent) toast.success("Stock subido a la nube");
}

function schedulePush() {
  if (!userId || applyingRemote) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void pushStockNow(), 700);
}

export async function pullStock(silent = true) {
  if (!userId) return;
  const { data, error } = await supabase
    .from("stock_state")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (!silent) toast.error("No se pudo leer el stock de la nube");
    return;
  }
  if (!data?.data) {
    if (!silent) toast.info("No hay stock guardado en la nube todavía");
    return;
  }
  applyingRemote = true;
  try {
    useStockStore.setState(data.data as never);
  } finally {
    applyingRemote = false;
  }
  setLocalTs(data.updated_at as string);
  if (!silent) toast.success("Stock actualizado desde la nube");
}

/** Fuerza subir este dispositivo a la nube (pisa lo remoto). */
export async function forcePushStock() {
  await pushStockNow(false);
}

/** Fuerza bajar la nube a este dispositivo (pisa lo local). */
export async function forcePullStock() {
  await pullStock(false);
}

export async function initStockSync(uid: string) {
  userId = uid;
  const { data } = await supabase
    .from("stock_state")
    .select("updated_at")
    .eq("user_id", uid)
    .maybeSingle();

  const remoteTs = (data?.updated_at as string | undefined) ?? "";
  const lts = localTs();

  if (remoteTs && (!lts || remoteTs > lts)) {
    await pullStock();
  } else {
    await pushStockNow();
  }

  if (!subscribed) {
    subscribed = true;
    useStockStore.subscribe(() => schedulePush());
  }
}

export function stopStockSync() {
  userId = null;
  if (timer) clearTimeout(timer);
}
