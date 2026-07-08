// Tipos del módulo de Stock Flexible (Etapa 11).
// Los datos viven en un store separado (persistente en navegador) para
// no acoplar la lógica de producción con la sincronización remota inicial.

export interface Tube {
  id: string;
  name: string;
  description?: string;
  cost: number;
  /** Rango en metros donde este tubo aplica. maxMeters=0 significa "sin límite". */
  minMeters: number;
  maxMeters: number;
  /** Stock disponible de tubos. */
  stock: number;
  active: boolean;
  createdAt: string;
}

export interface RawPurchase {
  id: string;
  productId: string;
  provider?: string;
  date: string;
  bobbins: number;
  metersPerBobbin: number;
  costPerBobbin: number;
  notes?: string;
  createdAt: string;
}

/** Lote de producto terminado (por medida, con costo histórico). */
export interface FinishedLot {
  id: string;
  productId: string;
  /** Medida (metros por unidad). */
  meters: number;
  qty: number;
  unitCost: number;
  productionId?: string;
  createdAt: string;
}

export interface ProductionOutput {
  meters: number;
  qty: number;
}

export interface ProductionWaste {
  meters: number;
  reason: string;
}

export interface Production {
  id: string;
  productId: string;
  date: string;
  outputs: ProductionOutput[];
  wastes: ProductionWaste[];
  metersUsed: number;      // outputs*meters + wastes
  filmCost: number;         // metros * costo promedio por metro al momento
  tubesCost: number;
  extraCost: number;
  totalCost: number;
  notes?: string;
  createdAt: string;
}

export interface StockSettings {
  defaultMetersPerBobbin: number;
  defaultWasteMeters: number;
  standardSizes: number[];
  extraCostPerUnit: number;
}
