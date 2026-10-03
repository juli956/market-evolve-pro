import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import {
  useStockStore,
  computeRawStock,
  finishedStockFor,
  computeAutoUnitCost,
  finishedLotAvgCost as lotAvgCost,
} from "@/lib/stock-store";
import type { SaleItem } from "@/lib/types";
import { getLocalDateString, currency } from "@/lib/utils-app";

interface DraftItem {
  key: string;
  productId: string;
  qty: number;
  price: number;
  meters?: number; // solo para production
  /** Costo ajustado manual (incluye comisiones/envío). Si es undefined se usa el automático. */
  cost?: number;
}

function emptyItem(): DraftItem {
  return { key: crypto.randomUUID(), productId: "", qty: 1, price: 0 };
}

interface ShortageInfo {
  productId: string;
  productName: string;
  meters: number;
  needed: number;
  available: number;
  missing: number;
  metersToProduce: number;
  rawMeters: number;
  avgCostPerMeter: number;
  canAutoProduce: boolean;
}

export function NewSale() {
  const products = useStore((s) => s.products);
  const clients = useStore((s) => s.clients);
  const addSale = useStore((s) => s.addSale);
  const addClient = useStore((s) => s.addClient);

  const purchases = useStockStore((s) => s.purchases);
  const productions = useStockStore((s) => s.productions);
  const finishedLots = useStockStore((s) => s.finishedLots);
  const tubes = useStockStore((s) => s.tubes);
  const settings = useStockStore((s) => s.settings);
  const registerProduction = useStockStore((s) => s.registerProduction);
  const consumeFinished = useStockStore((s) => s.consumeFinished);

  const [client, setClient] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [items, setItems] = useState<DraftItem[]>([]);
  const [shortages, setShortages] = useState<ShortageInfo[] | null>(null);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function autoCost(it: DraftItem): number {
    return computeAutoUnitCost(productMap.get(it.productId), it.meters, {
      finishedLots,
      purchases,
      productions,
      tubes,
    });
  }

  function effectiveCost(it: DraftItem): number {
    return it.cost !== undefined && !Number.isNaN(it.cost) ? it.cost : autoCost(it);
  }

  const { total, profit } = useMemo(() => {
    let t = 0;
    let g = 0;
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) continue;
      t += it.price * it.qty;
      g += (it.price - effectiveCost(it)) * it.qty;
    }
    return { total: t, profit: g };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, productMap, finishedLots, purchases, productions, tubes]);

  function addItem() {
    if (products.length === 0) {
      toast.error("Primero agregá productos");
      return;
    }
    setItems((xs) => [...xs, emptyItem()]);
  }
  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }
  function removeItem(key: string) {
    setItems((xs) => xs.filter((x) => x.key !== key));
  }

  function clear() {
    setClient("");
    setDate(getLocalDateString());
    setItems([]);
  }

  function buildFinalItems(): SaleItem[] {
    const finalItems: SaleItem[] = [];
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p || !it.price) continue;
      let name = p.name;
      if (p.stockType === "production" && it.meters) {
        name = `${p.name} · ${it.meters} m`;
      }
      const base = autoCost(it);
      const cost = effectiveCost(it);
      finalItems.push({
        productId: p.id,
        name,
        qty: it.qty,
        price: it.price,
        cost,
        profit: (it.price - cost) * it.qty,
        baseCost: base,
        commission: cost - base,
      });
    }
    return finalItems;
  }

  function finishedLotAvgCost(productId: string, meters: number): number | null {
    return lotAvgCost(finishedLots, productId, meters);
  }

  function detectShortages(): ShortageInfo[] {
    const short: ShortageInfo[] = [];
    // Agrupar cantidades por (productId, meters)
    const needMap = new Map<string, number>();
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p || p.stockType !== "production" || !it.meters) continue;
      const k = `${it.productId}::${it.meters}`;
      needMap.set(k, (needMap.get(k) ?? 0) + it.qty);
    }
    for (const [k, needed] of needMap) {
      const [productId, mStr] = k.split("::");
      const meters = parseFloat(mStr);
      const available = finishedStockFor(finishedLots, productId, meters);
      if (available < needed) {
        const missing = needed - available;
        const metersToProduce = missing * meters;
        const raw = computeRawStock(purchases, productions, productId);
        const canAutoProduce = raw.meters >= metersToProduce;
        const p = productMap.get(productId)!;
        short.push({
          productId,
          productName: p.name,
          meters,
          needed,
          available,
          missing,
          metersToProduce,
          rawMeters: raw.meters,
          avgCostPerMeter: raw.avgCostPerMeter,
          canAutoProduce,
        });
      }
    }
    return short;
  }

  function commitSale(finalItems: SaleItem[]) {
    const c = client.trim();
    addSale({
      client: c,
      date,
      items: finalItems,
      total: finalItems.reduce((a, i) => a + i.price * i.qty, 0),
      profit: finalItems.reduce((a, i) => a + i.profit, 0),
    });
    // Consumir lotes terminados de los ítems de producción
    for (const fi of finalItems) {
      const p = productMap.get(fi.productId);
      if (p?.stockType === "production") {
        // El nombre incluye "· X m" — reconstruir metros desde items originales
        const orig = items.find((x) => x.productId === fi.productId && x.qty === fi.qty && x.meters);
        if (orig?.meters) consumeFinished(fi.productId, orig.meters, fi.qty);
      }
    }
    const known = clients.some((x) => x.name.trim().toLowerCase() === c.toLowerCase());
    if (!known) addClient({ name: c });
    toast.success("Venta guardada");
    clear();
  }

  function save() {
    const c = client.trim();
    if (!c) { toast.error("Ingresá el cliente"); return; }
    if (!date) { toast.error("Seleccioná la fecha"); return; }

    // Validar que ítems de producción tengan metros
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (p?.stockType === "production" && !it.meters) {
        toast.error(`Indicá los metros para "${p.name}"`);
        return;
      }
    }

    const finalItems = buildFinalItems();
    if (finalItems.length === 0) {
      toast.error("Agregá al menos un producto con precio");
      return;
    }

    const short = detectShortages();
    if (short.length > 0) {
      setShortages(short);
      return;
    }
    commitSale(finalItems);
  }

  function handleAutoProduce() {
    if (!shortages) return;
    for (const s of shortages) {
      if (!s.canAutoProduce) {
        toast.error(`No hay suficiente materia prima para ${s.productName} ${s.meters}m`);
        return;
      }
      const res = registerProduction({
        productId: s.productId,
        date,
        outputs: [{ meters: s.meters, qty: s.missing }],
        wastes: settings.defaultWasteMeters > 0 ? [{ meters: settings.defaultWasteMeters, reason: "Auto-producción" }] : [],
        notes: "Producción automática desde venta",
      });
      if (!res.ok) { toast.error(res.error); return; }
    }
    toast.success("Producción automática registrada");
    setShortages(null);
    // Reintentar
    setTimeout(() => {
      const finalItems = buildFinalItems();
      commitSale(finalItems);
    }, 0);
  }

  function handleForceRawConsume() {
    if (!shortages) return;
    // Descontar directamente materia prima creando una "producción" que solo cubre lo faltante
    for (const s of shortages) {
      if (s.rawMeters < s.metersToProduce) {
        toast.error(`Materia prima insuficiente para ${s.productName}`);
        return;
      }
      const res = registerProduction({
        productId: s.productId,
        date,
        outputs: [{ meters: s.meters, qty: s.missing }],
        wastes: [],
        notes: "Descuento directo de materia prima",
      });
      if (!res.ok) { toast.error(res.error); return; }
    }
    setShortages(null);
    setTimeout(() => commitSale(buildFinalItems()), 0);
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">🛒 Nueva Venta</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Cliente</Label>
            <Input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Nombre del cliente"
              list="clients-datalist"
              autoComplete="off"
            />
            <datalist id="clients-datalist">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          <div>
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-semibold">Productos</h4>
          <Button onClick={addItem}>+ Agregar Producto</Button>
        </div>

        <div className="space-y-2">
          {items.map((it) => {
            const p = productMap.get(it.productId);
            const isProd = p?.stockType === "production";
            const baseCost = autoCost(it);
            const unitCost = effectiveCost(it);
            const commission = unitCost - baseCost;
            const commissionPct = baseCost > 0 ? (commission / baseCost) * 100 : 0;
            const itemProfit = p ? (it.price - unitCost) * it.qty : 0;
            const stockInfo = isProd && it.meters
              ? finishedStockFor(finishedLots, it.productId, it.meters)
              : null;
            return (
              <div
                key={it.key}
                className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/40 p-3 md:grid-cols-[2fr_1fr_.8fr_1fr_1fr_auto] md:items-end"
              >
                <div>
                  <Label className="text-xs text-muted-foreground">Producto</Label>
                  <Select
                    value={it.productId}
                    onValueChange={(v) => updateItem(it.key, { productId: v, meters: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.stockType === "production" ? "🏭" : ""} ({currency(p.cost)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isProd ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Metros</Label>
                    <Input
                      type="number"
                      min={1}
                      list={`sizes-${it.key}`}
                      value={it.meters ?? ""}
                      placeholder="ej: 1000"
                      onChange={(e) => updateItem(it.key, { meters: parseFloat(e.target.value) || undefined })}
                    />
                    <datalist id={`sizes-${it.key}`}>
                      {settings.standardSizes.map((s) => <option key={s} value={s} />)}
                    </datalist>
                    {stockInfo !== null && (
                      <p className={"mt-1 text-xs " + (stockInfo >= it.qty ? "text-success" : "text-warning")}>
                        Stock: {stockInfo} u
                      </p>
                    )}
                  </div>
                ) : (
                  <div />
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Cantidad</Label>
                  <Input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) =>
                      updateItem(it.key, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Costo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={it.cost ?? ""}
                    placeholder={baseCost ? baseCost.toFixed(2) : "0.00"}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateItem(it.key, { cost: v === "" ? undefined : parseFloat(v) || 0 });
                    }}
                  />
                  {it.cost !== undefined && commission !== 0 ? (
                    <p className="mt-1 text-xs text-warning">
                      Comisión {currency(commission)} ({commissionPct.toFixed(1)}%)
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Base: {currency(baseCost)}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Precio Venta</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={it.price || ""}
                    placeholder="0.00"
                    onChange={(e) =>
                      updateItem(it.key, { price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="flex flex-col items-start gap-1 md:items-end">
                  <Label className="text-xs text-muted-foreground">Ganancia</Label>
                  <div className="font-bold text-success">{currency(itemProfit)}</div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeItem(it.key)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Todavía no agregaste productos a esta venta.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total Venta:</span>
            <span className="text-info">{currency(total)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-bold text-success">
            <span>Ganancia Total:</span>
            <span>{currency(profit)}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            className="w-full bg-success text-success-foreground hover:opacity-90"
            onClick={save}
          >
            💾 Guardar Venta
          </Button>
          <Button variant="secondary" onClick={clear}>
            🗑️
          </Button>
        </div>
      </Card>

      <Dialog open={!!shortages} onOpenChange={(o) => !o && setShortages(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock terminado insuficiente</DialogTitle>
            <DialogDescription>
              Faltan unidades terminadas. Podés producir automáticamente desde la materia prima disponible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {shortages?.map((s) => (
              <div key={s.productId + s.meters} className="rounded-md border border-border bg-muted p-3">
                <div className="font-semibold">{s.productName} · {s.meters} m</div>
                <div>Necesitás {s.needed}, tenés {s.available}. Faltan <strong>{s.missing}</strong> unidades ({s.metersToProduce} m).</div>
                <div>Materia prima disponible: <strong>{s.rawMeters.toFixed(0)} m</strong> {s.canAutoProduce ? "✅" : "❌"}</div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-success text-success-foreground hover:opacity-90"
              disabled={!shortages?.every((s) => s.canAutoProduce)}
              onClick={handleAutoProduce}
            >
              Auto-producir y guardar venta
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleForceRawConsume}>
              Descontar materia prima directamente
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setShortages(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
