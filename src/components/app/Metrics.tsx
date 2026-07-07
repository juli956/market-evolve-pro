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
import {
  ResponsiveContainer,
  LineChart as RLineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Trophy,
  Users,
  Truck,
  TrendingUp,
  BarChart3,
  Award,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  getLocalDateString,
  currencyShort,
  currency,
  computeMargin,
} from "@/lib/utils-app";

type Period = "day" | "week" | "month" | "year" | "all" | "custom";

export function Metrics() {
  const sales = useStore((s) => s.sales);
  const products = useStore((s) => s.products);
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return getLocalDateString(d);
  });
  const [customTo, setCustomTo] = useState<string>(() => getLocalDateString());

  const { filtered, startDate, endDate } = useMemo(() => {
    const today = getLocalDateString();
    let start = "0000-01-01";
    let end = today;
    const d = new Date();
    if (period === "day") start = today;
    else if (period === "week") {
      d.setDate(d.getDate() - 7);
      start = getLocalDateString(d);
    } else if (period === "month") {
      d.setDate(1);
      start = getLocalDateString(d);
    } else if (period === "year") {
      start = `${d.getFullYear()}-01-01`;
    } else if (period === "custom") {
      start = customFrom;
      end = customTo;
    }
    return {
      filtered: sales.filter((s) => s.date >= start && s.date <= end),
      startDate: start,
      endDate: end,
    };
  }, [sales, period, customFrom, customTo]);

  const total = filtered.reduce((a, s) => a + s.total, 0);
  const profit = filtered.reduce((a, s) => a + s.profit, 0);
  const margin = computeMargin(total, profit);
  const ticket = filtered.length > 0 ? total / filtered.length : 0;

  const prodStats = useMemo(() => {
    const acc: Record<string, { qty: number; profit: number; cost: number; revenue: number }> = {};
    filtered.forEach((s) =>
      s.items.forEach((i) => {
        if (!acc[i.name]) acc[i.name] = { qty: 0, profit: 0, cost: 0, revenue: 0 };
        acc[i.name].qty += i.qty;
        acc[i.name].profit += i.profit;
        acc[i.name].cost += i.cost * i.qty;
        acc[i.name].revenue += i.price * i.qty;
      }),
    );
    return Object.entries(acc).sort((a, b) => b[1].profit - a[1].profit);
  }, [filtered]);

  const topProduct = prodStats[0];

  const clientStats = useMemo(() => {
    const acc: Record<string, { count: number; total: number; profit: number }> = {};
    filtered.forEach((s) => {
      const name = (s.client || "Sin nombre").trim() || "Sin nombre";
      if (!acc[name]) acc[name] = { count: 0, total: 0, profit: 0 };
      acc[name].count += 1;
      acc[name].total += s.total;
      acc[name].profit += s.profit;
    });
    return Object.entries(acc).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  const topClient = clientStats[0];

  const providerStats = useMemo(() => {
    const acc: Record<string, { qty: number; revenue: number; profit: number }> = {};
    const byName = new Map(products.map((p) => [p.name, p.provider?.trim() || ""]));
    filtered.forEach((s) =>
      s.items.forEach((i) => {
        const prov = byName.get(i.name) || "Sin proveedor";
        if (!acc[prov]) acc[prov] = { qty: 0, revenue: 0, profit: 0 };
        acc[prov].qty += i.qty;
        acc[prov].revenue += i.price * i.qty;
        acc[prov].profit += i.profit;
      }),
    );
    return Object.entries(acc).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [filtered, products]);

  const topProvider = providerStats[0];

  // Serie diaria últimos 30 días
  const dailySeries = useMemo(() => {
    const map: Record<string, { date: string; ventas: number; ganancia: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getLocalDateString(d);
      map[key] = { date: key.slice(5), ventas: 0, ganancia: 0 };
    }
    sales.forEach((s) => {
      if (map[s.date]) {
        map[s.date].ventas += s.total;
        map[s.date].ganancia += s.profit;
      }
    });
    return Object.values(map);
  }, [sales]);

  // Evolución mensual últimos 12 meses
  const monthlySeries = useMemo(() => {
    const map: Record<string, { mes: string; ventas: number; ganancia: number; acumulado: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = { mes: key, ventas: 0, ganancia: 0, acumulado: 0 };
    }
    sales.forEach((s) => {
      const key = s.date.slice(0, 7);
      if (map[key]) {
        map[key].ventas += s.total;
        map[key].ganancia += s.profit;
      }
    });
    let acc = 0;
    const arr = Object.values(map);
    arr.forEach((m) => {
      acc += m.ganancia;
      m.acumulado = acc;
    });
    return arr;
  }, [sales]);

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <BarChart3 className="h-5 w-5" />
        Análisis Detallado
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        <PeriodBtn active={period === "day"} onClick={() => setPeriod("day")}>Hoy</PeriodBtn>
        <PeriodBtn active={period === "week"} onClick={() => setPeriod("week")}>Semana</PeriodBtn>
        <PeriodBtn active={period === "month"} onClick={() => setPeriod("month")}>Mes</PeriodBtn>
        <PeriodBtn active={period === "year"} onClick={() => setPeriod("year")}>Año</PeriodBtn>
        <PeriodBtn active={period === "all"} onClick={() => setPeriod("all")}>Todo</PeriodBtn>
        <PeriodBtn active={period === "custom"} onClick={() => setPeriod("custom")}>Personalizado</PeriodBtn>
        {period === "custom" && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-popover px-2 py-1">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Desde
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Hasta
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              />
            </label>
          </div>
        )}
        <span className="ml-2 self-center text-xs text-muted-foreground">
          {period === "all"
            ? "Histórico completo"
            : period === "custom"
              ? `${startDate} → ${endDate}`
              : `Desde ${startDate}`}
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

      <div className="grid gap-4 md:grid-cols-3">
        <HighlightCard
          icon={<Trophy className="h-5 w-5 text-warning" />}
          title="Producto más rentable"
          primary={topProduct?.[0] ?? "—"}
          secondary={
            topProduct
              ? `${currency(topProduct[1].profit)} de ganancia · ${topProduct[1].qty} u.`
              : "Sin datos"
          }
        />
        <HighlightCard
          icon={<Users className="h-5 w-5 text-primary" />}
          title="Cliente top"
          primary={topClient?.[0] ?? "—"}
          secondary={
            topClient
              ? `${topClient[1].count} compras · ${currency(topClient[1].total)}`
              : "Sin datos"
          }
        />
        <HighlightCard
          icon={<Truck className="h-5 w-5 text-info" />}
          title="Proveedor más usado"
          primary={topProvider?.[0] ?? "—"}
          secondary={
            topProvider
              ? `${topProvider[1].qty} u. vendidas · ${currency(topProvider[1].revenue)}`
              : "Sin datos"
          }
        />
      </div>

      <Card className="p-5">
        <h4 className="mb-3 flex items-center gap-2 font-semibold">
          <TrendingUp className="h-4 w-4" />
          Ventas diarias (últimos 30 días)
        </h4>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => currency(v)} />
              <Legend />
              <Bar dataKey="ventas" fill="hsl(var(--primary))" name="Ventas" />
              <Bar dataKey="ganancia" fill="hsl(var(--success))" name="Ganancia" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="mb-3 flex items-center gap-2 font-semibold">
          <LineIcon /> Evolución anual (ganancia acumulada)
        </h4>
        <div className="h-64">
          <ResponsiveContainer>
            <RLineChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => currency(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="ganancia"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                name="Ganancia mensual"
              />
              <Line
                type="monotone"
                dataKey="acumulado"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Acumulado"
              />
            </RLineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h4 className="mb-3 flex items-center gap-2 font-semibold">
            <Award className="h-4 w-4 text-warning" />
            Top Productos por Ganancia
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cant.</TableHead>
                <TableHead>Ganancia</TableHead>
                <TableHead>Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prodStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Sin datos
                  </TableCell>
                </TableRow>
              )}
              {prodStats.slice(0, 10).map(([name, s]) => {
                const m = s.cost > 0 ? (s.profit / s.cost) * 100 : 0;
                return (
                  <TableRow key={name}>
                    <TableCell><strong>{name}</strong></TableCell>
                    <TableCell>{s.qty}</TableCell>
                    <TableCell className="text-success">{currency(s.profit)}</TableCell>
                    <TableCell>{m.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-5">
          <h4 className="mb-3 flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-primary" />
            Top Clientes
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Compras</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Ganancia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Sin datos
                  </TableCell>
                </TableRow>
              )}
              {clientStats.slice(0, 10).map(([name, s]) => (
                <TableRow key={name}>
                  <TableCell><strong>{name}</strong></TableCell>
                  <TableCell>{s.count}</TableCell>
                  <TableCell>{currency(s.total)}</TableCell>
                  <TableCell className="text-success">{currency(s.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="p-5">
        <h4 className="mb-3 flex items-center gap-2 font-semibold">
          <Truck className="h-4 w-4 text-info" />
          Proveedores
        </h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Unidades vendidas</TableHead>
              <TableHead>Facturación</TableHead>
              <TableHead>Ganancia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providerStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Sin datos
                </TableCell>
              </TableRow>
            )}
            {providerStats.map(([name, s]) => (
              <TableRow key={name}>
                <TableCell><strong>{name}</strong></TableCell>
                <TableCell>{s.qty}</TableCell>
                <TableCell>{currency(s.revenue)}</TableCell>
                <TableCell className="text-success">{currency(s.profit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function LineIcon() {
  return <TrendingUp className="h-4 w-4 text-success" />;
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

function HighlightCard({
  icon,
  title,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="rounded-md border border-border bg-popover p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-2 truncate text-lg font-bold">{primary}</div>
      <div className="text-xs text-muted-foreground">{secondary}</div>
    </div>
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
