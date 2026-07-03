// Tipos compartidos del Gestor de Ventas.
// Mantiene compatibilidad con el formato original (gp_products / gp_sales).

export interface ProductCostHistoryEntry {
  cost: number;
  date: string; // ISO
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
}

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
  profit: number;
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

export interface BackupPayload {
  version: number;
  createdAt: string;
  products: Product[];
  sales: Sale[];
}
