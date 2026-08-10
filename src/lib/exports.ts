// Exportaciones — replican exactamente las del HTML original.

import type { Product, Sale } from "./types";
import { getLocalDateString } from "./utils-app";

function download(filename: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const pct = (n: number) => `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;

function sheet(name: string, headers: string[], rows: (string | number)[][], title?: string) {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><caption style="font-weight:bold;font-size:14px;text-align:left">${esc(
    title ?? name,
  )}</caption><thead><tr>${head}</tr></thead><tbody>${
    body || `<tr><td colspan="${headers.length}">Sin datos</td></tr>`
  }</tbody></table>`;
}

function workbook(sheets: { name: string; html: string }[]) {
  const names = sheets
    .map(
      (s) =>
        `<x:ExcelWorksheet><x:Name>${esc(
          s.name,
        )}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>`,
    )
    .join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>${names}</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>th{background:#6366f1;color:#fff;padding:8px;text-align:left}td{padding:6px;border:1px solid #ddd}caption{padding:6px 0}</style>
</head><body>${sheets.map((s) => s.html).join("<br/>")}</body></html>`;
}

/** Excel de ventas detalladas + hojas de métricas del negocio. */
export function exportSalesExcel(sales: Sale[], products: Product[] = []) {
  const detalle = sales.flatMap((sale) =>
    sale.items.map((item) => {
      const margin = item.cost > 0 ? ((item.price - item.cost) / item.cost) * 100 : 0;
      const base = item.baseCost ?? item.cost;
      return [
        sale.date,
        sale.client,
        item.name,
        item.qty,
        money(base),
        money(item.cost),
        money(Math.max(0, item.cost - base) * item.qty),
        money(item.price),
        money(item.cost * item.qty),
        money(item.price * item.qty),
        money(item.profit),
        pct(margin),
        sale.paymentMethod ?? "",
        sale.notes ?? "",
      ] as (string | number)[];
    }),
  );

  const totalVentas = sales.reduce((a, s) => a + s.total, 0);
  const totalGanancia = sales.reduce((a, s) => a + s.profit, 0);
  const totalCosto = totalVentas - totalGanancia;
  const totalUnidades = sales.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + i.qty, 0),
    0,
  );
  const totalComisiones = sales.reduce(
    (a, s) =>
      a +
      s.items.reduce(
        (b, i) => b + Math.max(0, i.cost - (i.baseCost ?? i.cost)) * i.qty,
        0,
      ),
    0,
  );
  const clientesUnicos = new Set(sales.map((s) => (s.client || "Sin nombre").trim())).size;
  const fechas = sales.map((s) => s.date).sort();

  const resumen: (string | number)[][] = [
    ["Período", fechas.length ? `${fechas[0]} → ${fechas[fechas.length - 1]}` : "-"],
    ["Operaciones (ventas)", sales.length],
    ["Unidades vendidas", totalUnidades],
    ["Total facturado", money(totalVentas)],
    ["Costo total", money(totalCosto)],
    ["Ganancia neta", money(totalGanancia)],
    ["Margen sobre costo", pct(totalCosto > 0 ? (totalGanancia / totalCosto) * 100 : 0)],
    ["Margen sobre venta", pct(totalVentas > 0 ? (totalGanancia / totalVentas) * 100 : 0)],
    ["Comisiones / extras incluidos en costo", money(totalComisiones)],
    ["Ticket promedio", money(sales.length ? totalVentas / sales.length : 0)],
    ["Ganancia promedio por venta", money(sales.length ? totalGanancia / sales.length : 0)],
    ["Clientes distintos", clientesUnicos],
    ["Productos distintos vendidos", new Set(sales.flatMap((s) => s.items.map((i) => i.name))).size],
    ["Generado", getLocalDateString()],
  ];

  // Por producto (cantidades vendidas por unidad)
  const prodAcc: Record<
    string,
    { qty: number; revenue: number; cost: number; profit: number; ops: number }
  > = {};
  sales.forEach((s) =>
    s.items.forEach((i) => {
      const k = i.name;
      prodAcc[k] ??= { qty: 0, revenue: 0, cost: 0, profit: 0, ops: 0 };
      prodAcc[k].qty += i.qty;
      prodAcc[k].revenue += i.price * i.qty;
      prodAcc[k].cost += i.cost * i.qty;
      prodAcc[k].profit += i.profit;
      prodAcc[k].ops += 1;
    }),
  );
  const byName = new Map(products.map((p) => [p.name, p]));
  const porProducto = Object.entries(prodAcc)
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, v]) => {
      const p = byName.get(name);
      return [
        name,
        p?.stockType === "production" ? "Producción (film)" : "Simple",
        p?.provider ?? "Sin proveedor",
        v.qty,
        v.ops,
        money(v.revenue),
        money(v.cost),
        money(v.profit),
        pct(v.cost > 0 ? (v.profit / v.cost) * 100 : 0),
        money(v.qty ? v.revenue / v.qty : 0),
        p ? p.stock : "-",
      ] as (string | number)[];
    });

  // Por cliente
  const cliAcc: Record<string, { ops: number; qty: number; total: number; profit: number; last: string }> = {};
  sales.forEach((s) => {
    const k = (s.client || "Sin nombre").trim() || "Sin nombre";
    cliAcc[k] ??= { ops: 0, qty: 0, total: 0, profit: 0, last: "" };
    cliAcc[k].ops += 1;
    cliAcc[k].qty += s.items.reduce((a, i) => a + i.qty, 0);
    cliAcc[k].total += s.total;
    cliAcc[k].profit += s.profit;
    if (s.date > cliAcc[k].last) cliAcc[k].last = s.date;
  });
  const hoy = new Date(getLocalDateString());
  const porCliente = Object.entries(cliAcc)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, v]) => {
      const dias = Math.floor((hoy.getTime() - new Date(v.last).getTime()) / 86400000);
      return [
        name,
        v.ops,
        v.qty,
        money(v.total),
        money(v.profit),
        money(v.ops ? v.total / v.ops : 0),
        v.last,
        dias,
        dias > 60 ? "INACTIVO" : "Activo",
      ] as (string | number)[];
    });

  // Por proveedor
  const provAcc: Record<string, { qty: number; revenue: number; profit: number }> = {};
  sales.forEach((s) =>
    s.items.forEach((i) => {
      const prov = byName.get(i.name)?.provider?.trim() || "Sin proveedor";
      provAcc[prov] ??= { qty: 0, revenue: 0, profit: 0 };
      provAcc[prov].qty += i.qty;
      provAcc[prov].revenue += i.price * i.qty;
      provAcc[prov].profit += i.profit;
    }),
  );
  const porProveedor = Object.entries(provAcc)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, v]) => [name, v.qty, money(v.revenue), money(v.profit)] as (string | number)[]);

  // Por mes
  const mesAcc: Record<string, { ops: number; qty: number; total: number; profit: number }> = {};
  sales.forEach((s) => {
    const k = s.date.slice(0, 7);
    mesAcc[k] ??= { ops: 0, qty: 0, total: 0, profit: 0 };
    mesAcc[k].ops += 1;
    mesAcc[k].qty += s.items.reduce((a, i) => a + i.qty, 0);
    mesAcc[k].total += s.total;
    mesAcc[k].profit += s.profit;
  });
  const porMes = Object.entries(mesAcc)
    .sort()
    .reverse()
    .map(([mes, v]) => {
      const costo = v.total - v.profit;
      return [
        mes,
        v.ops,
        v.qty,
        money(v.total),
        money(costo),
        money(v.profit),
        pct(costo > 0 ? (v.profit / costo) * 100 : 0),
        money(v.ops ? v.total / v.ops : 0),
      ] as (string | number)[];
    });

  // Por medio de pago
  const pagoAcc: Record<string, { ops: number; total: number; profit: number }> = {};
  sales.forEach((s) => {
    const k = s.paymentMethod?.trim() || "Sin especificar";
    pagoAcc[k] ??= { ops: 0, total: 0, profit: 0 };
    pagoAcc[k].ops += 1;
    pagoAcc[k].total += s.total;
    pagoAcc[k].profit += s.profit;
  });
  const porPago = Object.entries(pagoAcc)
    .sort((a, b) => b[1].total - a[1].total)
    .map(
      ([name, v]) =>
        [
          name,
          v.ops,
          money(v.total),
          money(v.profit),
          pct(totalVentas > 0 ? (v.total / totalVentas) * 100 : 0),
        ] as (string | number)[],
    );

  const html = workbook([
    {
      name: "Resumen",
      html: sheet("Resumen", ["Métrica", "Valor"], resumen, "Resumen general del negocio"),
    },
    {
      name: "Detalle Ventas",
      html: sheet(
        "Detalle Ventas",
        [
          "Fecha",
          "Cliente",
          "Producto",
          "Cantidad",
          "Costo Base",
          "Costo Usado",
          "Comisión Total",
          "Precio Venta",
          "Costo Total",
          "Venta Total",
          "Ganancia",
          "Margen %",
          "Medio de Pago",
          "Notas",
        ],
        detalle,
        "Ventas detalladas",
      ),
    },
    {
      name: "Por Producto",
      html: sheet(
        "Por Producto",
        [
          "Producto",
          "Tipo de stock",
          "Proveedor",
          "Unidades vendidas",
          "Veces vendido",
          "Facturación",
          "Costo",
          "Ganancia",
          "Margen %",
          "Precio prom. unidad",
          "Stock actual",
        ],
        porProducto,
        "Métricas por producto",
      ),
    },
    {
      name: "Por Cliente",
      html: sheet(
        "Por Cliente",
        [
          "Cliente",
          "Compras",
          "Unidades",
          "Total",
          "Ganancia",
          "Ticket promedio",
          "Última compra",
          "Días sin comprar",
          "Estado",
        ],
        porCliente,
        "Métricas por cliente",
      ),
    },
    {
      name: "Por Proveedor",
      html: sheet(
        "Por Proveedor",
        ["Proveedor", "Unidades vendidas", "Facturación", "Ganancia"],
        porProveedor,
        "Métricas por proveedor",
      ),
    },
    {
      name: "Por Mes",
      html: sheet(
        "Por Mes",
        [
          "Mes",
          "Operaciones",
          "Unidades",
          "Total ventas",
          "Costo",
          "Ganancia",
          "Margen %",
          "Ticket promedio",
        ],
        porMes,
        "Evolución mensual",
      ),
    },
    {
      name: "Medios de Pago",
      html: sheet(
        "Medios de Pago",
        ["Medio de pago", "Operaciones", "Total", "Ganancia", "% del total"],
        porPago,
        "Métricas por medio de pago",
      ),
    },
  ]);

  download(
    `ventas_y_metricas_${getLocalDateString()}.xls`,
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
