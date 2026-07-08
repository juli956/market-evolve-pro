// Store del módulo de Stock Flexible (Etapa 11).
// Persistente en localStorage. Independiente del store principal para no
// romper el sync remoto: cuando se necesite subir a la nube, se hará en una
// etapa siguiente. Toda la lógica (raw material, producciones, lotes
// terminados, tubos, mermas, reglas de tubo, costos) vive acá.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Tube,
  RawPurchase,
  FinishedLot,
  Production,
  ProductionOutput,
  ProductionWaste,
  StockSettings,
} from "./stock-types";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString() + Math.random().toString(36).slice(2, 8);
}

const DEFAULT_TUBES: Tube[] = [
  {
    id: uid(),
    name: "Tubo chico",
    description: "Hasta 500 metros",
    cost: 350,
    minMeters: 0,
    maxMeters: 500,
    stock: 0,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: "Tubo grande",
    description: "Desde 501 metros",
    cost: 500,
    minMeters: 501,
    maxMeters: 0,
    stock: 0,
    active: true,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_SETTINGS: StockSettings = {
  defaultMetersPerBobbin: 5000,
  defaultWasteMeters: 0,
  standardSizes: [100, 200, 300, 500, 800, 1000],
  extraCostPerUnit: 0,
};

interface StockState {
  tubes: Tube[];
  purchases: RawPurchase[];
  productions: Production[];
  finishedLots: FinishedLot[];
  settings: StockSettings;

  // tubos
  addTube: (t: Omit<Tube, "id" | "createdAt">) => void;
  updateTube: (id: string, patch: Partial<Tube>) => void;
  deleteTube: (id: string) => void;
  adjustTubeStock: (id: string, delta: number) => void;

  // materia prima
  addPurchase: (p: Omit<RawPurchase, "id" | "createdAt">) => void;
  deletePurchase: (id: string) => void;

  // producciones
  registerProduction: (params: {
    productId: string;
    date: string;
    outputs: ProductionOutput[];
    wastes: ProductionWaste[];
    notes?: string;
  }) => { ok: true; production: Production } | { ok: false; error: string };
  deleteProduction: (id: string) => void;

  // lotes (consumo por venta)
  consumeFinished: (productId: string, meters: number, qty: number) => { unitCost: number } | null;
  restoreFinished: (productId: string, meters: number, qty: number, unitCost: number) => void;

  // settings
  updateSettings: (patch: Partial<StockSettings>) => void;
}

/** Devuelve el tubo activo aplicable para una medida (en metros). */
export function pickTubeForMeters(tubes: Tube[], meters: number): Tube | null {
  const candidates = tubes.filter(
    (t) => t.active && meters >= t.minMeters && (t.maxMeters === 0 || meters <= t.maxMeters),
  );
  if (candidates.length === 0) return null;
  // preferir el rango más chico/específico
  candidates.sort((a, b) => (a.maxMeters || Infinity) - (b.maxMeters || Infinity));
  return candidates[0];
}

/** Stock de materia prima (metros disponibles y costo prom por metro) para un producto de producción. */
export function computeRawStock(purchases: RawPurchase[], productions: Production[], productId: string) {
  let meters = 0;
  let cost = 0;
  for (const p of purchases) {
    if (p.productId !== productId) continue;
    const tot = p.bobbins * p.metersPerBobbin;
    meters += tot;
    cost += p.bobbins * p.costPerBobbin;
  }
  const bought = meters;
  for (const pr of productions) {
    if (pr.productId !== productId) continue;
    meters -= pr.metersUsed;
  }
  const avgCostPerMeter = bought > 0 ? cost / bought : 0;
  return { meters, avgCostPerMeter, bought };
}

/** Bobinas jumbo compradas menos consumidas (aproximado por metros/metrosPorBobina promedio). */
export function computeRawBobbins(purchases: RawPurchase[], productions: Production[], productId: string) {
  let bobbins = 0;
  let meters = 0;
  for (const p of purchases) {
    if (p.productId !== productId) continue;
    bobbins += p.bobbins;
    meters += p.bobbins * p.metersPerBobbin;
  }
  const usedMeters = productions
    .filter((pr) => pr.productId === productId)
    .reduce((a, pr) => a + pr.metersUsed, 0);
  const avgMeters = bobbins > 0 ? meters / bobbins : 0;
  const bobbinsUsedApprox = avgMeters > 0 ? usedMeters / avgMeters : 0;
  return { totalBobbins: bobbins, avgMetersPerBobbin: avgMeters, bobbinsRemaining: Math.max(0, bobbins - bobbinsUsedApprox) };
}

/** Sumatoria de unidades terminadas por (productId, meters). */
export function finishedStockFor(lots: FinishedLot[], productId: string, meters?: number) {
  return lots
    .filter((l) => l.productId === productId && (meters === undefined || l.meters === meters))
    .reduce((a, l) => a + l.qty, 0);
}

const STORAGE_KEY = "gestor-ventas:stock:v1";

export const useStockStore = create<StockState>()(
  persist(
    (set, get) => ({
      tubes: DEFAULT_TUBES,
      purchases: [],
      productions: [],
      finishedLots: [],
      settings: DEFAULT_SETTINGS,

      addTube: (t) =>
        set((s) => ({
          tubes: [...s.tubes, { ...t, id: uid(), createdAt: new Date().toISOString() }],
        })),
      updateTube: (id, patch) =>
        set((s) => ({ tubes: s.tubes.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTube: (id) => set((s) => ({ tubes: s.tubes.filter((t) => t.id !== id) })),
      adjustTubeStock: (id, delta) =>
        set((s) => ({
          tubes: s.tubes.map((t) => (t.id === id ? { ...t, stock: t.stock + delta } : t)),
        })),

      addPurchase: (p) =>
        set((s) => ({
          purchases: [
            ...s.purchases,
            { ...p, id: uid(), createdAt: new Date().toISOString() },
          ],
        })),
      deletePurchase: (id) => set((s) => ({ purchases: s.purchases.filter((p) => p.id !== id) })),

      registerProduction: ({ productId, date, outputs, wastes, notes }) => {
        const state = get();
        const cleanOutputs = outputs.filter((o) => o.meters > 0 && o.qty > 0);
        const cleanWastes = wastes.filter((w) => w.meters > 0);
        if (cleanOutputs.length === 0) {
          return { ok: false, error: "Agregá al menos una salida (metros × cantidad)" };
        }
        const outputMeters = cleanOutputs.reduce((a, o) => a + o.meters * o.qty, 0);
        const wasteMeters = cleanWastes.reduce((a, w) => a + w.meters, 0);
        const metersUsed = outputMeters + wasteMeters;
        const raw = computeRawStock(state.purchases, state.productions, productId);
        if (metersUsed > raw.meters + 1e-6) {
          return {
            ok: false,
            error: `Materia prima insuficiente. Necesitás ${metersUsed} m y hay ${raw.meters.toFixed(0)} m.`,
          };
        }

        // costos por salida
        const filmCost = metersUsed * raw.avgCostPerMeter;
        // tubos: uno por unidad
        let tubesCost = 0;
        const tubeDelta = new Map<string, number>();
        for (const o of cleanOutputs) {
          const tube = pickTubeForMeters(state.tubes, o.meters);
          if (tube) {
            tubesCost += tube.cost * o.qty;
            tubeDelta.set(tube.id, (tubeDelta.get(tube.id) ?? 0) + o.qty);
          }
        }
        const totalUnits = cleanOutputs.reduce((a, o) => a + o.qty, 0);
        const extraCost = state.settings.extraCostPerUnit * totalUnits;
        const totalCost = filmCost + tubesCost + extraCost;

        // Distribuir costo por lote (proporcional a los metros de la salida)
        const totalOutputMeters = outputMeters || 1;
        const production: Production = {
          id: uid(),
          productId,
          date,
          outputs: cleanOutputs,
          wastes: cleanWastes,
          metersUsed,
          filmCost,
          tubesCost,
          extraCost,
          totalCost,
          notes,
          createdAt: new Date().toISOString(),
        };
        const newLots: FinishedLot[] = cleanOutputs.map((o) => {
          const share = (o.meters * o.qty) / totalOutputMeters;
          const filmShare = filmCost * share;
          const tube = pickTubeForMeters(state.tubes, o.meters);
          const tubeShare = tube ? tube.cost * o.qty : 0;
          const extraShare = state.settings.extraCostPerUnit * o.qty;
          const unitCost = (filmShare + tubeShare + extraShare) / o.qty;
          return {
            id: uid(),
            productId,
            meters: o.meters,
            qty: o.qty,
            unitCost,
            productionId: production.id,
            createdAt: new Date().toISOString(),
          };
        });

        set((s) => ({
          productions: [...s.productions, production],
          finishedLots: [...s.finishedLots, ...newLots],
          tubes: s.tubes.map((t) =>
            tubeDelta.has(t.id) ? { ...t, stock: t.stock - (tubeDelta.get(t.id) ?? 0) } : t,
          ),
        }));
        return { ok: true, production };
      },

      deleteProduction: (id) =>
        set((s) => ({
          productions: s.productions.filter((p) => p.id !== id),
          finishedLots: s.finishedLots.filter((l) => l.productionId !== id),
        })),

      consumeFinished: (productId, meters, qty) => {
        const state = get();
        const lots = state.finishedLots
          .filter((l) => l.productId === productId && l.meters === meters && l.qty > 0)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // FIFO
        const total = lots.reduce((a, l) => a + l.qty, 0);
        if (total < qty) return null;
        let remaining = qty;
        let costSum = 0;
        const updated = new Map<string, number>();
        for (const l of lots) {
          if (remaining <= 0) break;
          const take = Math.min(l.qty, remaining);
          costSum += take * l.unitCost;
          updated.set(l.id, l.qty - take);
          remaining -= take;
        }
        set((s) => ({
          finishedLots: s.finishedLots
            .map((l) => (updated.has(l.id) ? { ...l, qty: updated.get(l.id) ?? l.qty } : l))
            .filter((l) => l.qty > 0),
        }));
        return { unitCost: costSum / qty };
      },

      restoreFinished: (productId, meters, qty, unitCost) =>
        set((s) => ({
          finishedLots: [
            ...s.finishedLots,
            {
              id: uid(),
              productId,
              meters,
              qty,
              unitCost,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
