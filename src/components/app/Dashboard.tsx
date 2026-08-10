import { useMemo } from "react";
import {
  AlertTriangle,
  TrendingUp,
  CalendarDays,
  Trophy,
  CreditCard,
  Users,
  FileSpreadsheet,
  FileText,
  Save,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { getLocalDateString, currencyShort, computeMargin, chartTooltipProps } from "@/lib/utils-app";
import { exportSalesExcel, exportMonthlySummary, exportSalesCSV } from "@/lib/exports";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { Sale } from "@/lib/types";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const PIE_COLORS = [
  "hsl(221 83% 53%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(199 89% 48%)",
  "hsl(280 68% 60%)",
  "hsl(340 82% 55%)",
];

function sumTotal(list: Sale[]) {
  return list.reduce((a, s) => a + s.total, 0);
}
function sumProfit(list: Sale[]) {
  return list.reduce((a, s) => a + s.profit, 0);
}
function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

export function Dashboard() {
  const sales = useStore((s) => s.sales);
  const products = useStore((s) => s.products);

  const today = getLocalDateString();
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  }, []);

  const todaySales = useMemo(() => sales.filter((s) => s.date === today), [sales, today]);
  const yesterdaySales = useMemo(() => sales.filter((s) => s.date === yesterday), [sales, yesterday]);

  const total = sumTotal(todaySales);
  const profit = sumProfit(todaySales);
  const margin = computeMargin(total, profit);

  const totalYesterday = sumTotal(yesterdaySales);
  const profitYesterday = sumProfit(yesterdaySales);
  const dTotal = pctDelta(total, totalYesterday);
  const dProfit = pctDelta(profit, profitYesterday);

  // ---- KPI mensual vs mes anterior
  const monthCompare = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const inMonth = (s: Sale, yy: number, mm: number) => {
      const [sy, sm] = s.date.split("-").map(Number);
      return sy === yy && sm === mm + 1;
    };
    const currList = sales.filter((s) => inMonth(s, y, m));
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    const prevList = sales.filter((s) => inMonth(s, prevY, prevM));
    return {
      currTotal: sumTotal(currList),
      currProfit: sumProfit(currList),
      prevTotal: sumTotal(prevList),
      prevProfit: sumProfit(prevList),
      count: currList.length,
    };
  }, [sales]);

  const dMonthTotal = pctDelta(monthCompare.currTotal, monthCompare.prevTotal);
  const dMonthProfit = pctDelta(monthCompare.currProfit, monthCompare.prevProfit);

  // ---- Ventas de la semana (chart)
  const weekData = useMemo(() => {
    const days: { date: string; label: string; ventas: number; ganancia: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = getLocalDateString(d);
      const daySales = sales.filter((s) => s.date === date);
      days.push({
        date,
        label: DAY_NAMES[d.getDay()],
        ventas: sumTotal(daySales),
        ganancia: sumProfit(daySales),
      });
    }
    return days;
  }, [sales]);

  // ---- Últimos 30 días (line)
  const monthTrend = useMemo(() => {
    const arr: { date: string; label: string; ventas: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = getLocalDateString(d);
      arr.push({
        date,
        label: String(d.getDate()).padStart(2, "0"),
        ventas: sumTotal(sales.filter((s) => s.date === date)),
      });
    }
    return arr;
  }, [sales]);

  // ---- Top productos del mes
  const topProductsMonth = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const acc: Record<string, { qty: number; profit: number }> = {};
    sales
      .filter((s) => s.date.startsWith(prefix))
      .forEach((s) =>
        s.items.forEach((i) => {
          if (!acc[i.name]) acc[i.name] = { qty: 0, profit: 0 };
          acc[i.name].qty += i.qty;
          acc[i.name].profit += i.profit;
        }),
      );
    return Object.entries(acc)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [sales]);

  // ---- Top clientes del mes
  const topClientsMonth = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const acc: Record<string, { total: number; count: number }> = {};
    sales
      .filter((s) => s.date.startsWith(prefix))
      .forEach((s) => {
        const c = (s.client || "Sin cliente").trim() || "Sin cliente";
        if (!acc[c]) acc[c] = { total: 0, count: 0 };
        acc[c].total += s.total;
        acc[c].count += 1;
      });
    return Object.entries(acc)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [sales]);

  // ---- Métodos de pago del mes
  const paymentBreakdown = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const acc: Record<string, number> = {};
    sales
      .filter((s) => s.date.startsWith(prefix))
      .forEach((s) => {
        const m = s.paymentMethod || "Sin especificar";
        acc[m] = (acc[m] ?? 0) + s.total;
      });
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [sales]);

  // ---- Alertas de stock bajo
  const lowStock = useMemo(
    () => products.filter((p) => p.controlStock && (p.stock ?? 0) <= 3),
    [products],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ventas Hoy"
          value={currencyShort(total)}
          delta={dTotal}
          accent="primary"
        />
        <StatCard
          label="Ganancia Hoy"
          value={currencyShort(profit)}
          delta={dProfit}
          accent="success"
          valueClass="text-success"
        />
        <StatCard label="Margen Hoy" value={margin.toFixed(1) + "%"} accent="info" valueClass="text-info" />
        <StatCard label="Transacciones Hoy" value={String(todaySales.length)} accent="warning" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Mes Actual · Ventas"
          value={currencyShort(monthCompare.currTotal)}
          delta={dMonthTotal}
          accent="primary"
          hint={`vs mes anterior: ${currencyShort(monthCompare.prevTotal)}`}
        />
        <StatCard
          label="Mes Actual · Ganancia"
          value={currencyShort(monthCompare.currProfit)}
          delta={dMonthProfit}
          accent="success"
          valueClass="text-success"
          hint={`vs mes anterior: ${currencyShort(monthCompare.prevProfit)}`}
        />
        <StatCard
          label="Mes Actual · Ticket prom."
          value={
            monthCompare.count > 0
              ? currencyShort(monthCompare.currTotal / monthCompare.count)
              : "$0"
          }
          accent="info"
          valueClass="text-info"
          hint={`${monthCompare.count} operaciones`}
        />
      </div>

      {lowStock.length > 0 && (
        <Card className="animate-in fade-in duration-300 border-warning/40 bg-warning/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
            Stock bajo ({lowStock.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span
                key={p.id}
                className="rounded-full bg-warning px-3 py-1 text-xs font-medium text-warning-foreground"
              >
                {p.name}: {p.stock} u.
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 transition-shadow hover:shadow-md">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            Ventas de la Semana
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => currencyShort(Number(v))} />
                <Tooltip
                  {...chartTooltipProps}
                  formatter={(v: number, k) => [currencyShort(v), k === "ventas" ? "Ventas" : "Ganancia"]}
                  />
                <Bar dataKey="ventas" fill="hsl(221 83% 53%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ganancia" fill="hsl(160 84% 39%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 transition-shadow hover:shadow-md">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Últimos 30 días
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => currencyShort(Number(v))} />
                <Tooltip
                  {...chartTooltipProps}
                  formatter={(v: number) => [currencyShort(v), "Ventas"]}
                  />
                <Line
                  type="monotone"
                  dataKey="ventas"
                  stroke="hsl(221 83% 53%)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 transition-shadow hover:shadow-md lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-warning" />
            Top Productos del Mes
          </h3>
          {topProductsMonth.length === 0 ? (
            <EmptyState message="Sin ventas este mes." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topProductsMonth}
                  margin={{ top: 4, right: 12, left: 12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => currencyShort(Number(v))} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip
                    {...chartTooltipProps}
                    formatter={(v: number) => [currencyShort(v), "Ganancia"]}
                    />
                  <Bar dataKey="profit" fill="hsl(160 84% 39%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5 transition-shadow hover:shadow-md">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <CreditCard className="h-4 w-4 text-info" />
            Métodos de Pago
          </h3>
          {paymentBreakdown.length === 0 ? (
            <EmptyState message="Sin datos este mes." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {paymentBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltipProps}
                    formatter={(v: number) => currencyShort(v)}
                    />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 transition-shadow hover:shadow-md">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Top Clientes del Mes
        </h3>
        {topClientsMonth.length === 0 ? (
          <EmptyState message="Sin ventas este mes." />
        ) : (
          <ul className="divide-y divide-border">
            {topClientsMonth.map((c, i) => (
              <li
                key={c.name}
                className="flex items-center justify-between py-2 text-sm transition-colors hover:bg-muted/40"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <strong>{c.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {c.count} {c.count === 1 ? "venta" : "ventas"}
                  </span>
                </span>
                <span className="font-semibold text-success">{currencyShort(c.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-semibold">
          <Save className="h-4 w-4 text-primary" />
          Exportar Datos
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Descargá tus datos para Excel o respaldo
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-success text-success-foreground hover:opacity-90"
            onClick={() => exportSalesExcel(sales, products)}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel (Ventas + Métricas)
          </Button>
          <Button
            className="bg-warning text-warning-foreground hover:opacity-90"
            onClick={() => exportMonthlySummary(sales)}
          >
            <TrendingUp className="h-4 w-4" />
            Exportar Resumen Mensual
          </Button>
          <Button variant="secondary" onClick={() => exportSalesCSV(sales)}>
            <FileText className="h-4 w-4" />
            Exportar CSV Simple
          </Button>
        </div>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  hint,
  accent,
  valueClass,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  accent: "primary" | "success" | "info" | "warning";
  valueClass?: string;
}) {
  const border = {
    primary: "border-l-primary",
    success: "border-l-success",
    info: "border-l-info",
    warning: "border-l-warning",
  }[accent];

  let deltaEl: React.ReactNode = null;
  if (delta !== undefined && delta !== null) {
    const up = delta >= 0;
    deltaEl = (
      <span
        className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold ${
          up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
        }`}
      >
        {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
      </span>
    );
  } else if (delta === null) {
    deltaEl = <span className="ml-2 text-xs text-muted-foreground">–</span>;
  }

  return (
    <div className={`rounded-md border border-border border-l-4 bg-popover p-4 shadow-sm ${border}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline">
        <span className={`text-3xl font-bold ${valueClass ?? ""}`}>{value}</span>
        {deltaEl}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
