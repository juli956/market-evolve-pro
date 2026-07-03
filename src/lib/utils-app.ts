// Helpers puros. Sin dependencias del store.

export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(d?: string): string {
  if (!d) return "-";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

export function currency(n: number, decimals = 2): string {
  return "$" + (Number.isFinite(n) ? n : 0).toFixed(decimals);
}

export function currencyShort(n: number): string {
  return "$" + Math.round(Number.isFinite(n) ? n : 0).toLocaleString("es-AR");
}

/** Margen sobre costo (ganancia / costo * 100). Mantiene la fórmula original. */
export function computeMargin(total: number, profit: number): number {
  const cost = total - profit;
  return cost > 0 ? (profit / cost) * 100 : 0;
}

export function debounce<T extends (...a: unknown[]) => void>(fn: T, ms = 200) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
