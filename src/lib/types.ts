// Tipos compartidos del Gestor de Ventas.
// Mantiene compatibilidad con el formato original (gp_products / gp_sales).

export interface ProductCostHistoryEntry {
  cost: number;
  date: string; // ISO
}

export type StockType = "simple" | "production";

export interface ProductionConfig {
  /** Ancho en cm (ej: 30, 38, 45). Solo informativo/agrupación. */
  widthCm?: number;
  /** Metros por bobina jumbo por defecto. */
  defaultMetersPerBobbin?: number;
  /** Merma sugerida por producción (en metros). */
  defaultWasteMeters?: number;
}

export interface Product {
  id: string;
  name: string;
  provider?: string;
  cost: number;
  stock: number;
  controlStock: boolean;
  history: ProductCostHistoryEntry[];
  createdAt: string; // ISO
  /** Modo de control de stock. Por compatibilidad, si falta se asume "simple". */
  stockType?: StockType;
  productionConfig?: ProductionConfig;
}

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
  profit: number;
  /** Costo original del catálogo, cuando en la venta se usó un costo ajustado. */
  baseCost?: number;
  /** Comisión/extra por unidad incluido en `cost` (cost - baseCost). */
  commission?: number;
}

export interface Sale {
  id: string;
  client: string;
  date: string; // YYYY-MM-DD
  items: SaleItem[];
  total: number;
  profit: number;
  notes?: string;
  paymentMethod?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export type Client = Contact;
export type Provider = Contact;

export interface BackupPayload {
  version: number;
  createdAt: string;
  products: Product[];
  sales: Sale[];
  clients?: Client[];
  providers?: Provider[];
}
