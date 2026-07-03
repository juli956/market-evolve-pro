import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { getLocalDateString, currencyShort, computeMargin } from "@/lib/utils-app";
import { exportSalesExcel, exportMonthlySummary, exportSalesCSV } from "@/lib/exports";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export function Dashboard() {
  const sales = useStore((s) => s.sales);

  const today = getLocalDateString();
  const todaySales = useMemo(() => sales.filter((s) => s.date === today), [sales, today]);

  const total = todaySales.reduce((a, s) => a + s.total, 0);
  const profit = todaySales.reduce((a, s) => a + s.profit, 0);
  const margin = computeMargin(total, profit);

  const weekData = useMemo(() => {
    const days: { date: string; label: string; isToday: boolean; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = getLocalDateString(d);
      const value = sales.filter((s) => s.date === date).reduce((a, s) => a + s.total, 0);
      days.push({ date, label: DAY_NAMES[d.getDay()], isToday: i === 0, value });
    }
    return days;
  }, [sales]);

  const maxWeek = Math.max(100, ...weekData.map((d) => d.value));

  const topProductsToday = useMemo(() => {
    const count: Record<string, number> = {};
    todaySales.forEach((s) =>
      s.items.forEach((i) => {
        count[i.name] = (count[i.name] ?? 0) + i.qty;
      }),
    );
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [todaySales]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ventas Hoy" value={currencyShort(total)} accent="primary" />
        <StatCard
          label="Ganancia Neta"
          value={currencyShort(profit)}
          accent="success"
          valueClass="text-success"
        />
        <StatCard
          label="Margen Promedio"
          value={margin.toFixed(1) + "%"}
          accent="info"
          valueClass="text-info"
        />
        <StatCard label="Transacciones" value={String(todaySales.length)} accent="warning" />
      </div>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">📈 Ventas de la Semana</h3>
        <div className="flex h-40 items-end gap-2 rounded-md bg-muted/60 p-5 pb-8 pt-6">
          {weekData.map((d) => {
            const h = Math.max(5, (d.value / maxWeek) * 100);
            return (
              <div
                key={d.date}
                className="relative flex-1 rounded-t"
                style={{
                  height: h + "%",
                  minWidth: 30,
                  background: d.isToday
                    ? "linear-gradient(to top,var(--success),oklch(0.6 0.17 162))"
                    : "linear-gradient(to top,var(--primary),var(--info))",
                }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-foreground">
                  {d.value > 0 ? currencyShort(d.value) : ""}
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">🏆 Productos Más Vendidos Hoy</h3>
        {topProductsToday.length === 0 ? (
          <span className="text-muted-foreground">Sin ventas hoy</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topProductsToday.map(([name, qty], i) => {
              const colors = [
                "var(--primary)",
                "var(--info)",
                "oklch(0.62 0.24 302)",
                "oklch(0.66 0.26 342)",
                "oklch(0.65 0.24 15)",
              ];
              return (
                <span
                  key={name}
                  className="rounded-full px-4 py-1.5 text-sm font-medium text-primary-foreground"
                  style={{ background: colors[i] }}
                >
                  {name}: {qty} u.
                </span>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 font-semibold">💾 Exportar Datos</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Descargá tus datos para Excel o respaldo
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-success text-success-foreground hover:opacity-90"
            onClick={() => exportSalesExcel(sales)}
          >
            📊 Exportar Excel (Ventas Detalladas)
          </Button>
          <Button
            className="bg-warning text-warning-foreground hover:opacity-90"
            onClick={() => exportMonthlySummary(sales)}
          >
            📈 Exportar Resumen Mensual
          </Button>
          <Button variant="secondary" onClick={() => exportSalesCSV(sales)}>
            📄 Exportar CSV Simple
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  valueClass,
}: {
  label: string;
  value: string;
  accent: "primary" | "success" | "info" | "warning";
  valueClass?: string;
}) {
  const border = {
    primary: "border-l-primary",
    success: "border-l-success",
    info: "border-l-info",
    warning: "border-l-warning",
  }[accent];
  return (
    <div className={`rounded-md border border-border border-l-4 bg-popover p-4 shadow-sm ${border}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
}
