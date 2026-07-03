// Exportaciones — replican exactamente las del HTML original.

import type { Sale } from "./types";
import { getLocalDateString } from "./utils-app";

function download(filename: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportSalesExcel(sales: Sale[]) {
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><style>th{background:#6366f1;color:white;padding:8px}td{padding:8px;border:1px solid #ddd}</style></head>
    <body><table><thead><tr>
      <th>Fecha</th><th>Cliente</th><th>Producto</th><th>Cantidad</th>
      <th>Costo Unitario</th><th>Precio Venta</th><th>Costo Total</th>
      <th>Venta Total</th><th>Ganancia</th><th>Margen %</th>
    </tr></thead><tbody>`;
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const margin =
        item.cost > 0 ? (((item.price - item.cost) / item.cost) * 100).toFixed(1) : "0";
      html += `<tr>
        <td>${sale.date}</td><td>${sale.client}</td><td>${item.name}</td>
        <td>${item.qty}</td><td>$${item.cost.toFixed(2)}</td>
        <td>$${item.price.toFixed(2)}</td>
        <td>$${(item.cost * item.qty).toFixed(2)}</td>
        <td>$${(item.price * item.qty).toFixed(2)}</td>
        <td>$${item.profit.toFixed(2)}</td><td>${margin}%</td>
      </tr>`;
    });
  });
  html += `</tbody></table></body></html>`;
  download(
    `ventas_detalle_${getLocalDateString()}.xls`,
    new Blob([html], { type: "application/vnd.ms-excel" }),
  );
}

export function exportMonthlySummary(sales: Sale[]) {
  const stats: Record<string, { ventas: number; ganancia: number; transacciones: number }> = {};
  sales.forEach((s) => {
    const month = s.date.substring(0, 7);
    if (!stats[month]) stats[month] = { ventas: 0, ganancia: 0, transacciones: 0 };
    stats[month].ventas += s.total;
    stats[month].ganancia += s.profit;
    stats[month].transacciones += 1;
  });
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><style>th{background:#f59e0b;color:white;padding:8px}td{padding:8px;border:1px solid #ddd}</style></head>
    <body><h2>Resumen Mensual de Ventas</h2><table><thead><tr>
      <th>Mes</th><th>Transacciones</th><th>Total Ventas</th><th>Total Ganancia</th><th>Margen Promedio</th>
    </tr></thead><tbody>`;
  Object.entries(stats)
    .sort()
    .reverse()
    .forEach(([month, s]) => {
      const cost = s.ventas - s.ganancia;
      const margin = cost > 0 ? ((s.ganancia / cost) * 100).toFixed(1) : "0";
      html += `<tr>
        <td>${month}</td><td>${s.transacciones}</td>
        <td>$${s.ventas.toFixed(2)}</td><td>$${s.ganancia.toFixed(2)}</td>
        <td>${margin}%</td>
      </tr>`;
    });
  html += `</tbody></table></body></html>`;
  download(
    `resumen_mensual_${getLocalDateString()}.xls`,
    new Blob([html], { type: "application/vnd.ms-excel" }),
  );
}

export function exportSalesCSV(sales: Sale[]) {
  let csv = "FECHA,CLIENTE,PRODUCTO,CANTIDAD,COSTO,PRECIO,GANANCIA\n";
  sales.forEach((s) =>
    s.items.forEach((i) => {
      const client = s.client.replaceAll(",", " ");
      const name = i.name.replaceAll(",", " ");
      csv += `${s.date},${client},${name},${i.qty},${i.cost},${i.price},${i.profit}\n`;
    }),
  );
  download(`ventas_${getLocalDateString()}.csv`, new Blob([csv], { type: "text/csv" }));
}
