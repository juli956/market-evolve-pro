// Análisis de frecuencia de compra por cliente.
// Puro: recibe ventas y devuelve estadísticas. No toca el store.

import type { Sale } from "./types";

export interface ClientThresholds {
  /** Multiplicador de la frecuencia para marcar "compra demorada". */
  delayMult: number;
  /** Multiplicador de la frecuencia para marcar "inactivo". */
  inactiveMult: number;
  /** Días antes de la fecha estimada para mostrar "próxima compra". */
  upcomingDays: number;
}

export const DEFAULT_THRESHOLDS: ClientThresholds = {
  delayMult: 1.5,
  inactiveMult: 2,
  upcomingDays: 3,
};

export type ClientStatus =
  | "no-sales"
  | "new"
  | "active"
  | "upcoming"
  | "delayed"
  | "inactive";

export interface ClientStats {
  /** Fechas de compra únicas (una por día), ordenadas ascendente. */
  purchaseDays: string[];
  /** Cantidad de operaciones (un día = una compra, aunque tenga varios productos). */
  count: number;
  lastDate: string | null;
  daysSince: number | null;
  /** Promedio de días entre compras. */
  avgInterval: number | null;
  /** Frecuencia habitual estimada (mediana, robusta a compras atípicas). */
  frequency: number | null;
  /** true cuando la frecuencia proviene de solo 2 compras. */
  provisional: boolean;
  /** Fecha estimada de la próxima compra. */
  nextDate: string | null;
  /** Días que faltan para la próxima compra (puede ser negativo). */
  daysUntilNext: number | null;
  status: ClientStatus;
  /** Días transcurridos por encima del umbral de demora (solo si delayed/inactive). */
  daysDelayed: number;
  /** Días transcurridos por encima del umbral de inactividad (solo si inactive). */
  daysInactive: number;
  /** Motivo legible del estado actual. */
  reason: string;
}

const DAY_MS = 86400000;

function parseDay(d: string): number {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, dd ?? 1);
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function formatShort(dateMs: number): string {
  const d = new Date(dateMs);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/**
 * Calcula el seguimiento de frecuencia para un cliente a partir de sus ventas.
 * Reglas:
 * - Varias líneas de la misma operación = 1 compra (se usa la fecha de la venta).
 * - Varias compras el mismo día cuentan como una sola.
 * - 1 compra → "Cliente nuevo"; 2 compras → frecuencia provisional; 3+ → confiable.
 * - Frecuencia = mediana de intervalos (evita que una compra atípica la distorsione).
 */
export function computeClientStats(
  sales: Sale[],
  clientName: string,
  thresholds: ClientThresholds = DEFAULT_THRESHOLDS,
  now: number = Date.now(),
): ClientStats {
  const key = clientName.trim().toLowerCase();
  const days = new Set<string>();
  sales.forEach((s) => {
    if ((s.client || "").trim().toLowerCase() !== key) return;
    if (s.date) days.add(s.date);
  });
  const purchaseDays = [...days].sort();
  const count = purchaseDays.length;

  const empty: ClientStats = {
    purchaseDays,
    count,
    lastDate: null,
    daysSince: null,
    avgInterval: null,
    frequency: null,
    provisional: false,
    nextDate: null,
    daysUntilNext: null,
    status: "no-sales",
    daysDelayed: 0,
    daysInactive: 0,
    reason: "Sin compras registradas.",
  };
  if (count === 0) return empty;

  const lastDate = purchaseDays[count - 1];
  const todayMs = parseDay(
    new Date(now).toISOString().slice(0, 10),
  );
  const daysSince = Math.max(
    0,
    Math.round((todayMs - parseDay(lastDate)) / DAY_MS),
  );

  if (count === 1) {
    return {
      ...empty,
      lastDate,
      daysSince,
      status: "new",
      reason: `Cliente nuevo: 1 compra el ${formatShort(parseDay(lastDate))}. Aún no hay frecuencia calculada.`,
    };
  }

  const intervals: number[] = [];
  for (let i = 1; i < count; i++) {
    intervals.push((parseDay(purchaseDays[i]) - parseDay(purchaseDays[i - 1])) / DAY_MS);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const frequency = count >= 3 ? median(intervals) : avgInterval;
  const provisional = count === 2;
  const freqRounded = Math.max(1, Math.round(frequency));

  const nextMs = parseDay(lastDate) + freqRounded * DAY_MS;
  const daysUntilNext = Math.round((nextMs - todayMs) / DAY_MS);

  const delayLimit = thresholds.delayMult * freqRounded;
  const inactiveLimit = thresholds.inactiveMult * freqRounded;

  let status: ClientStatus;
  let reason: string;
  let daysDelayed = 0;
  let daysInactive = 0;

  if (daysSince > inactiveLimit) {
    status = "inactive";
    daysInactive = Math.round(daysSince - inactiveLimit);
    daysDelayed = Math.round(daysSince - delayLimit);
    reason = `Inactivo: ${daysSince} días sin comprar (${daysInactive} días más allá de su límite de inactividad de ${Math.round(inactiveLimit)} días). Compra habitualmente cada ${freqRounded} días.`;
  } else if (daysSince > delayLimit) {
    status = "delayed";
    daysDelayed = Math.round(daysSince - delayLimit);
    reason = `Compra demorada: ${daysSince} días sin comprar, ${daysDelayed} días más allá de lo habitual (compra cada ${freqRounded} días).`;
  } else if (daysUntilNext >= 0 && daysUntilNext <= thresholds.upcomingDays) {
    status = "upcoming";
    reason = `Próxima compra esperada en ${daysUntilNext} día${daysUntilNext === 1 ? "" : "s"} (estimada: ${formatShort(nextMs)}).`;
  } else {
    status = "active";
    reason = daysUntilNext > 0
      ? `Dentro de su ciclo habitual. Próxima compra estimada: ${formatShort(nextMs)}.`
      : `Dentro de su ciclo habitual (compra cada ${freqRounded} días).`;
  }

  return {
    purchaseDays,
    count,
    lastDate,
    daysSince,
    avgInterval,
    frequency,
    provisional,
    nextDate: new Date(nextMs).toISOString().slice(0, 10),
    daysUntilNext,
    status,
    daysDelayed,
    daysInactive,
    reason,
  };
}

export interface StatusInfo {
  label: (stats: ClientStats) => string;
  className: string;
}

/** Etiqueta y estilo de cada estado, alineados al tema de la app. */
export const STATUS_INFO: Record<ClientStatus, StatusInfo> = {
  "no-sales": {
    label: () => "Sin compras",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  new: {
    label: () => "Cliente nuevo",
    className: "border-info/40 bg-info/10 text-info",
  },
  active: {
    label: (s) =>
      `Compra cada ${Math.max(1, Math.round(s.frequency ?? 0))}d${s.provisional ? " (provisional)" : ""}`,
    className: "border-success/40 bg-success/10 text-success",
  },
  upcoming: {
    label: (s) => `Próx. compra en ${s.daysUntilNext}d`,
    className: "border-info/40 bg-info/10 text-info",
  },
  delayed: {
    label: (s) => `Demorado ${s.daysDelayed}d`,
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  inactive: {
    label: (s) => `Inactivo ${s.daysInactive}d`,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

/** Mensaje de WhatsApp sugerido según el estado del cliente. */
export function whatsappTemplate(
  clientName: string,
  stats: ClientStats,
): string {
  const nombre = clientName.split(" ")[0] || clientName;
  if (stats.status === "inactive" || stats.status === "delayed") {
    return `¡Hola ${nombre}! ¿Cómo estás? Te escribo de EMBALAST para saber si necesitás reponer film stretch. Estamos a disposición para pasarte precios y coordinar tu próximo pedido.`;
  }
  if (stats.status === "upcoming") {
    return `¡Hola ${nombre}! ¿Cómo estás? Te escribo de EMBALAST: se acerca la fecha de tu pedido habitual de film stretch. Si necesitás, te pasamos precios actualizados y coordinamos la entrega.`;
  }
  return `¡Hola ${nombre}! ¿Cómo estás? Te escribo de EMBALAST. Si necesitás reponer film stretch, estamos a disposición para pasarte precios y coordinar tu pedido.`;
}
