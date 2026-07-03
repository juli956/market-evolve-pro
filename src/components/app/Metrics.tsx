import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { getLocalDateString, currencyShort, currency, computeMargin } from "@/lib/utils-app";

type Period = "day" | "week" | "month";

export function Metrics() {
  const sales = useStore((s) => s.sales);
  const [period, setPeriod] = useState<Period>("day");

  const { filtered, startDate } = useMemo(() => {
    const today = getLocalDateString();
    let start = today;
    if (period === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = getLocalDateString(d);
    } else if (period === "month") {
      const d = new Date();
      d.setDate(1);
      start = getLocalDateString(d);
    }
    return {
      filtered: sales.filter((s) => s.date >= start && s.date <= today),
      startDate: start,
    };
  }, [sales, period]);

  const total = filtered.reduce((a, s) => a + s.total, 0);
  const profit = filtered.reduce((a, s) => a + s.profit, 0);
  const margin = computeMargin(total, profit);
  const ticket = filtered.length > 0 ? total / filtered.length : 0;

  const prodStats = useMemo(() => {
    const acc: Record<string, { qty: number; profit: number; cost: number }> = {};
    filtered.forEach((s) =>
      s.items.forEach((i) => {
        if (!acc[i.name]) acc[i.name] = { qty: 0, profit: 0, cost: 0 };
        acc[i.name].qty += i.qty;
        acc[i.name].profit += i.profit;
        acc[i.name].cost += i.cost * i.qty;
      }),
    );
    return Object.entries(acc).sort((a, b) => b[1].profit - a[1].profit);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">📊 Análisis Detallado</h3>

      <div className="flex flex-wrap gap-2">
        <PeriodBtn active={period === "day"} onClick={() => setPeriod("day")}>
          Hoy
        </PeriodBtn>
        <PeriodBtn active={period === "week"} onClick={() => setPeriod("week")}>
          Semana
        </PeriodBtn>
        <PeriodBtn active={period === "month"} onClick={() => setPeriod("month")}>
          Mes
        </PeriodBtn>
        <span className="ml-2 self-center text-xs text-muted-foreground">
          Desde {startDate}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Ventas" value={currencyShort(total)} accent="primary" />
        <Stat
          label="Ganancia Neta"
          value={currencyShort(profit)}
          accent="success"
          valueClass="text-success"
        />
        <Stat
          label="Margen Promedio"
          value={margin.toFixed(1) + "%"}
          accent="info"
          valueClass="text-info"
        />
        <Stat label="Ticket Promedio" value={currencyShort(ticket)} accent="warning" />
      </div>

      <Card className="p-5">
        <h4 className="mb-3 font-semibold">🏆 Top Productos por Ganancia</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad Vendida</TableHead>
              <TableHead>Ganancia Total</TableHead>
              <TableHead>Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prodStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Sin datos para este período
                </TableCell>
              </TableRow>
            )}
            {prodStats.map(([name, s]) => {
              const m = s.cost > 0 ? (s.profit / s.cost) * 100 : 0;
              return (
                <TableRow key={name}>
                  <TableCell>
                    <strong>{name}</strong>
                  </TableCell>
                  <TableCell>{s.qty}</TableCell>
                  <TableCell className="text-success">{currency(s.profit)}</TableCell>
                  <TableCell>{m.toFixed(1)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function PeriodBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant={active ? "default" : "secondary"} onClick={onClick}>
      {children}
    </Button>
  );
}

function Stat({
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
