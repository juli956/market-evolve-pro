// Respaldos JSON — Etapa 2.
// - createBackup: genera y descarga un JSON completo.
// - restoreBackup: valida y devuelve el payload.
// - autoBackup: snapshot diario en localStorage (últimos 7 días).

import type { BackupPayload, Product, Sale } from "./types";
import { getLocalDateString } from "./utils-app";

export const BACKUP_VERSION = 1;
const AUTO_KEY = "gestor-ventas:auto-backups";
const MAX_AUTO = 7;

export function buildBackup(products: Product[], sales: Sale[]): BackupPayload {
  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    products,
    sales,
  };
}

export function downloadBackup(products: Product[], sales: Sale[]) {
  const payload = buildBackup(products, sales);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const now = new Date();
  const stamp =
    getLocalDateString(now) +
    "-" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gestor-ventas-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function readBackupFile(file: File): Promise<BackupPayload> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") throw new Error("Archivo inválido");
  if (typeof data.version !== "number") throw new Error("Falta el campo version");
  if (!Array.isArray(data.products) || !Array.isArray(data.sales)) {
    throw new Error("El respaldo no contiene productos y ventas");
  }
  return data as BackupPayload;
}

// ---- Respaldo automático diario ----

interface AutoEntry {
  date: string; // YYYY-MM-DD
  payload: BackupPayload;
}

export function runAutoBackup(products: Product[], sales: Sale[]) {
  if (typeof window === "undefined") return;
  try {
    const today = getLocalDateString();
    const raw = localStorage.getItem(AUTO_KEY);
    const list: AutoEntry[] = raw ? JSON.parse(raw) : [];
    if (list.some((e) => e.date === today)) return;
    list.push({ date: today, payload: buildBackup(products, sales) });
    while (list.length > MAX_AUTO) list.shift();
    localStorage.setItem(AUTO_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function listAutoBackups(): AutoEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    return raw ? (JSON.parse(raw) as AutoEntry[]) : [];
  } catch {
    return [];
  }
}

export function downloadAutoBackup(entry: AutoEntry) {
  const blob = new Blob([JSON.stringify(entry.payload, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gestor-ventas-auto-${entry.date}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
