import { useMemo, useState } from "react";
import { Plus, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { useStockStore, computeAutoUnitCost } from "@/lib/stock-store";
import { getLocalDateString, formatDate, currency } from "@/lib/utils-app";

interface QItem {
  key: string;
  productId: string;
  meters?: number;
  qty: number;
  margin: number; // % sobre costo
  price: number; // precio unitario
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function Quoter() {
  const products = useStore((s) => s.products);
  const finishedLots = useStockStore((s) => s.finishedLots);
  const purchases = useStockStore((s) => s.purchases);
  const productions = useStockStore((s) => s.productions);
  const tubes = useStockStore((s) => s.tubes);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [company, setCompany] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [items, setItems] = useState<QItem[]>([]);

  const costOf = (it: Pick<QItem, "productId" | "meters">) =>
    computeAutoUnitCost(productMap.get(it.productId), it.meters, {
      finishedLots,
      purchases,
      productions,
      tubes,
    });

  function update(key: string, patch: Partial<QItem>, source: "cost" | "margin" | "price" = "cost") {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const n = { ...it, ...patch };
        const c = costOf(n);
        if (source === "price") n.margin = c > 0 ? r2(((n.price - c) / c) * 100) : 0;
        else n.price = r2(c * (1 + (n.margin || 0) / 100));
        return n;
      }),
    );
  }

  const total = items.reduce((a, it) => a + it.price * it.qty, 0);

  async function download() {
    const valid = items.filter((it) => productMap.get(it.productId) && it.qty > 0);
    if (!valid.length) return toast.error("Agregá al menos un producto");
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("EMBALAST INSUMOS", w / 2, 22, { align: "center" });
    doc.setDrawColor(40);
    doc.line(14, 28, w - 14, 28);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${formatDate(date)}`, 14, 38);
    doc.text(`Empresa: ${company || "-"}`, 14, 45);
    doc.setFont("helvetica", "bold");
    doc.text("COTIZACIÓN", w - 14, 38, { align: "right" });
    autoTable(doc, {
      startY: 54,
      head: [["Producto", "Metros", "Cantidad", "Precio unitario", "Precio total"]],
      body: valid.map((it) => [
        productMap.get(it.productId)!.name,
        it.meters ? String(it.meters) : "-",
        String(it.qty),
        currency(it.price),
        currency(it.price * it.qty),
      ]),
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      styles: { fontSize: 10 },
    });
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: ${currency(valid.reduce((a, it) => a + it.price * it.qty, 0))}`, w - 14, y, { align: "right" });
    doc.save(`cotizacion_${(company || "cliente").replace(/\s+/g, "_")}_${date}.pdf`);
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 border-b border-border pb-3 text-center">
          <h2 className="text-2xl font-bold tracking-wide">EMBALAST INSUMOS</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Empresa / Cliente</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de la empresa" />
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Productos cotizados</h3>
          <Button
            size="sm"
            onClick={() =>
              setItems((p) => [...p, { key: crypto.randomUUID(), productId: "", qty: 1, margin: 30, price: 0 }])
            }
          >
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>
        {items.length === 0 && <p className="text-sm text-muted-foreground">Agregá un producto para cotizar.</p>}
        {items.map((it) => {
          const p = productMap.get(it.productId);
          const isProd = p?.stockType === "production";
          const cost = costOf(it);
          return (
            <div key={it.key} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-7 sm:items-end">
              <div className="col-span-2">
                <Label>Producto</Label>
                <Select value={it.productId} onValueChange={(v) => update(it.key, { productId: v })}>
                  <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Metros</Label>
                <Input
                  type="number"
                  disabled={!isProd}
                  value={it.meters ?? ""}
                  onChange={(e) => update(it.key, { meters: e.target.value ? parseFloat(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min={1} value={it.qty} onChange={(e) => update(it.key, { qty: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Ganancia %</Label>
                <Input type="number" value={it.margin} onChange={(e) => update(it.key, { margin: parseFloat(e.target.value) || 0 }, "margin")} />
              </div>
              <div>
                <Label>Precio unit.</Label>
                <Input type="number" value={it.price} onChange={(e) => update(it.key, { price: parseFloat(e.target.value) || 0 }, "price")} />
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Costo: {currency(cost)}</div>
                  <div className="font-semibold">{currency(it.price * it.qty)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((x) => x.key !== it.key))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="text-lg font-bold">TOTAL: {currency(total)}</div>
          <Button onClick={download}>
            <FileDown className="h-4 w-4" /> Descargar cotización
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          El costo y el % de ganancia son solo internos: el PDF muestra únicamente precios finales. La cotización no registra ventas ni descuenta stock.
        </p>
      </Card>
    </div>
  );
}
