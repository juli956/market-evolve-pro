import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportSalesExcel, monthLabel } from "@/lib/exports";
import { getLocalDateString } from "@/lib/utils-app";
import type { Product, Sale } from "@/lib/types";
import { toast } from "sonner";

export function ExportExcelDialog({ sales, products }: { sales: Sale[]; products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"month" | "custom">("month");
  const today = getLocalDateString();
  const months = useMemo(() => {
    const set = new Set(sales.map((s) => s.date.slice(0, 7)));
    set.add(today.slice(0, 7));
    return [...set].sort().reverse();
  }, [sales, today]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);

  function run() {
    if (mode === "month") {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      exportSalesExcel(sales, products, {
        from: `${month}-01`,
        to: `${month}-${String(last).padStart(2, "0")}`,
        label: monthLabel(month),
      });
    } else {
      if (!from || !to || from > to) return toast.error("Revisá las fechas desde/hasta");
      exportSalesExcel(sales, products, { from, to, label: "Período personalizado" });
    }
    setOpen(false);
  }

  return (
    <>
      <Button className="bg-success text-success-foreground hover:opacity-90" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" />
        Exportar Excel (Ventas + Métricas)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Excel</DialogTitle>
            <DialogDescription>
              Elegí el período del detalle de ventas. Los datos históricos se incluyen siempre completos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={mode === "month" ? "default" : "secondary"} onClick={() => setMode("month")}>
                Mes
              </Button>
              <Button variant={mode === "custom" ? "default" : "secondary"} onClick={() => setMode("custom")}>
                Desde / Hasta
              </Button>
            </div>
            {mode === "month" ? (
              <div>
                <Label>Mes</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Desde</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <Label>Hasta</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={run}>Descargar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
