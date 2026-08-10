import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import {
  useStockStore,
  computeRawStock,
  computeRawBobbins,
  finishedStockFor,
  pickTubeForMeters,
} from "@/lib/stock-store";
import type { Tube, ProductionOutput, ProductionWaste } from "@/lib/stock-types";
import { currency, formatDate, getLocalDateString } from "@/lib/utils-app";

type SubTab = "raw" | "productions" | "finished" | "tubes" | "settings";

export function Stock() {
  const [tab, setTab] = useState<SubTab>("raw");
  const TABS: { id: SubTab; label: string }[] = [
    { id: "raw", label: "🧵 Materia prima" },
    { id: "productions", label: "🏭 Producciones" },
    { id: "finished", label: "📦 Stock terminado" },
    { id: "tubes", label: "🧻 Tubos" },
    { id: "settings", label: "⚙️ Configuración" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "flex-1 rounded px-3 py-2 text-sm font-medium transition-colors " +
              (tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "raw" && <RawMaterialsTab />}
      {tab === "productions" && <ProductionsTab />}
      {tab === "finished" && <FinishedStockTab />}
      {tab === "tubes" && <TubesTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

// -------------------- Materia prima --------------------

function RawMaterialsTab() {
  const products = useStore((s) => s.products);
  const providers = useStore((s) => s.providers);
  const purchases = useStockStore((s) => s.purchases);
  const productions = useStockStore((s) => s.productions);
  const settings = useStockStore((s) => s.settings);
  const addPurchase = useStockStore((s) => s.addPurchase);
  const deletePurchase = useStockStore((s) => s.deletePurchase);

  const prodProducts = products.filter((p) => p.stockType === "production");
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Materia prima (bobinas jumbo)</h3>
        <Button onClick={() => setOpen(true)} disabled={prodProducts.length === 0}>
          + Registrar compra
        </Button>
      </div>

      {prodProducts.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">
          Todavía no hay productos con modo <strong>Producción</strong>. Creá o editá un producto
          desde la pestaña Productos y elegí <em>Stock de producción</em>.
        </Card>
      )}

      {prodProducts.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Bobinas restantes</TableHead>
                <TableHead>Metros disponibles</TableHead>
                <TableHead>Costo prom / m</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prodProducts.map((p) => {
                const raw = computeRawStock(purchases, productions, p.id);
                const b = computeRawBobbins(purchases, productions, p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell><strong>{p.name}</strong></TableCell>
                    <TableCell>≈ {b.bobbinsRemaining.toFixed(1)} / {b.totalBobbins}</TableCell>
                    <TableCell>
                      {raw.meters > 0 ? (
                        <Badge className="bg-success text-success-foreground">{raw.meters.toFixed(0)} m</Badge>
                      ) : (
                        <Badge variant="destructive">0 m</Badge>
                      )}
                    </TableCell>
                    <TableCell>{currency(raw.avgCostPerMeter, 4)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-2 text-sm font-semibold">Compras registradas</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Bobinas</TableHead>
              <TableHead>m / bobina</TableHead>
              <TableHead>Costo / bobina</TableHead>
              <TableHead>Costo / metro</TableHead>
              <TableHead>Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                  No hay compras registradas.
                </TableCell>
              </TableRow>
            )}
            {purchases
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((p) => {
                const prod = products.find((x) => x.id === p.productId);
                const totalM = p.bobbins * p.metersPerBobbin;
                const costM = p.costPerBobbin / p.metersPerBobbin;
                return (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell>{prod?.name ?? "?"}</TableCell>
                    <TableCell>{p.provider || "-"}</TableCell>
                    <TableCell>{p.bobbins}</TableCell>
                    <TableCell>{p.metersPerBobbin}</TableCell>
                    <TableCell>{currency(p.costPerBobbin)}</TableCell>
                    <TableCell>{currency(costM, 4)}</TableCell>
                    <TableCell>{currency(p.bobbins * p.costPerBobbin)} · {totalM} m</TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => { deletePurchase(p.id); toast.success("Compra eliminada"); }}>
                        🗑️
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>

      <PurchaseDialog
        open={open}
        onOpenChange={setOpen}
        products={prodProducts}
        providers={providers.map((p) => p.name)}
        defaultMeters={settings.defaultMetersPerBobbin}
        onSave={(data) => {
          addPurchase(data);
          toast.success("Compra registrada");
          setOpen(false);
        }}
      />
    </div>
  );
}

function PurchaseDialog({
  open,
  onOpenChange,
  products,
  providers,
  defaultMeters,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: { id: string; name: string; productionConfig?: { defaultMetersPerBobbin?: number } }[];
  providers: string[];
  defaultMeters: number;
  onSave: (d: {
    productId: string;
    provider?: string;
    date: string;
    bobbins: number;
    metersPerBobbin: number;
    costPerBobbin: number;
    notes?: string;
  }) => void;
}) {
  const [productId, setProductId] = useState("");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [bobbins, setBobbins] = useState("");
  const [meters, setMeters] = useState(String(defaultMeters));
  const [cost, setCost] = useState("");

  const selected = products.find((p) => p.id === productId);
  const currentMetersDefault = selected?.productionConfig?.defaultMetersPerBobbin ?? defaultMeters;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar compra de materia prima</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!productId) { toast.error("Elegí un producto"); return; }
            const b = parseFloat(bobbins), m = parseFloat(meters), c = parseFloat(cost);
            if (!(b > 0) || !(m > 0) || !(c >= 0)) { toast.error("Datos inválidos"); return; }
            onSave({ productId, provider: provider.trim() || undefined, date, bobbins: b, metersPerBobbin: m, costPerBobbin: c });
            setProductId(""); setProvider(""); setBobbins(""); setCost(""); setMeters(String(defaultMeters));
          }}
        >
          <div>
            <Label>Producto</Label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); const p = products.find((x) => x.id === v); if (p?.productionConfig?.defaultMetersPerBobbin) setMeters(String(p.productionConfig.defaultMetersPerBobbin)); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Proveedor</Label>
              <Input value={provider} onChange={(e) => setProvider(e.target.value)} list="providers-datalist" autoComplete="off" />
              <datalist id="providers-datalist">{providers.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Bobinas</Label>
              <Input type="number" min={1} value={bobbins} onChange={(e) => setBobbins(e.target.value)} required />
            </div>
            <div>
              <Label>Metros / bobina</Label>
              <Input type="number" min={1} value={meters} onChange={(e) => setMeters(e.target.value)} required />
              <p className="mt-1 text-xs text-muted-foreground">Por defecto: {currentMetersDefault}</p>
            </div>
            <div>
              <Label>Costo / bobina</Label>
              <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required />
            </div>
          </div>
          {bobbins && meters && cost && (
            <div className="rounded-md bg-muted p-3 text-sm">
              Total: <strong>{(parseFloat(bobbins) * parseFloat(meters)).toLocaleString("es-AR")} m</strong> · Costo total: <strong>{currency(parseFloat(bobbins) * parseFloat(cost))}</strong> · Costo/m: <strong>{currency(parseFloat(cost) / parseFloat(meters), 4)}</strong>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-success text-success-foreground hover:opacity-90">Guardar compra</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Producciones --------------------

function ProductionsTab() {
  const products = useStore((s) => s.products);
  const productions = useStockStore((s) => s.productions);
  const purchases = useStockStore((s) => s.purchases);
  const settings = useStockStore((s) => s.settings);
  const tubes = useStockStore((s) => s.tubes);
  const register = useStockStore((s) => s.registerProduction);
  const del = useStockStore((s) => s.deleteProduction);
  const prodProducts = products.filter((p) => p.stockType === "production");
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Producciones</h3>
        <Button onClick={() => setOpen(true)} disabled={prodProducts.length === 0}>+ Nueva producción</Button>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Salidas</TableHead>
              <TableHead>Merma</TableHead>
              <TableHead>Metros usados</TableHead>
              <TableHead>Costo total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productions.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No hay producciones registradas.</TableCell></TableRow>
            )}
            {productions.slice().sort((a, b) => b.date.localeCompare(a.date)).map((pr) => {
              const prod = products.find((p) => p.id === pr.productId);
              const totalWaste = pr.wastes.reduce((a, w) => a + w.meters, 0);
              return (
                <TableRow key={pr.id}>
                  <TableCell>{formatDate(pr.date)}</TableCell>
                  <TableCell>{prod?.name ?? "?"}</TableCell>
                  <TableCell className="text-xs">{pr.outputs.map((o) => `${o.qty}×${o.meters}m`).join(", ")}</TableCell>
                  <TableCell>{totalWaste} m</TableCell>
                  <TableCell>{pr.metersUsed} m</TableCell>
                  <TableCell>{currency(pr.totalCost)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" onClick={() => { del(pr.id); toast.success("Producción eliminada"); }}>🗑️</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <ProductionDialog
        open={open}
        onOpenChange={setOpen}
        products={prodProducts}
        purchases={purchases}
        productions={productions}
        standardSizes={settings.standardSizes}
        defaultWaste={settings.defaultWasteMeters}
        tubes={tubes}
        onSave={({ productId, date, outputs, wastes, notes }) => {
          const res = register({ productId, date, outputs, wastes, notes });
          if (!res.ok) { toast.error(res.error); return false; }
          toast.success("Producción registrada");
          setOpen(false);
          return true;
        }}
      />
    </div>
  );
}

function ProductionDialog({
  open,
  onOpenChange,
  products,
  purchases,
  productions,
  standardSizes,
  defaultWaste,
  tubes,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: { id: string; name: string }[];
  purchases: ReturnType<typeof useStockStore.getState>["purchases"];
  productions: ReturnType<typeof useStockStore.getState>["productions"];
  standardSizes: number[];
  defaultWaste: number;
  tubes: Tube[];
  onSave: (data: { productId: string; date: string; outputs: ProductionOutput[]; wastes: ProductionWaste[]; notes?: string }) => boolean;
}) {
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [outputs, setOutputs] = useState<ProductionOutput[]>([{ meters: 0, qty: 1 }]);
  const [wastes, setWastes] = useState<ProductionWaste[]>(defaultWaste > 0 ? [{ meters: defaultWaste, reason: "Merma estándar" }] : []);
  const [notes, setNotes] = useState("");

  const raw = productId ? computeRawStock(purchases, productions, productId) : { meters: 0, avgCostPerMeter: 0, bought: 0 };
  const outputMeters = outputs.reduce((a, o) => a + (o.meters || 0) * (o.qty || 0), 0);
  const wasteMeters = wastes.reduce((a, w) => a + (w.meters || 0), 0);
  const totalMeters = outputMeters + wasteMeters;
  const totalUnits = outputs.reduce((a, o) => a + (o.qty || 0), 0);
  const filmCost = totalMeters * raw.avgCostPerMeter;
  const tubesCost = outputs.reduce((a, o) => { const t = pickTubeForMeters(tubes, o.meters); return a + (t ? t.cost * o.qty : 0); }, 0);
  const totalCost = filmCost + tubesCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nueva producción</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Producto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Salidas (unidades terminadas)</Label>
              <Button size="sm" variant="secondary" onClick={() => setOutputs((xs) => [...xs, { meters: 0, qty: 1 }])}>+ Salida</Button>
            </div>
            {standardSizes.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {standardSizes.map((s) => (
                  <Button key={s} type="button" size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setOutputs((xs) => [...xs, { meters: s, qty: 1 }])}>
                    + {s} m
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {outputs.map((o, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input type="number" min={1} placeholder="Metros" value={o.meters || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setOutputs((xs) => xs.map((x, j) => j === i ? { ...x, meters: v } : x)); }} />
                  <Input type="number" min={1} placeholder="Cantidad" value={o.qty || ""} onChange={(e) => { const v = parseInt(e.target.value) || 0; setOutputs((xs) => xs.map((x, j) => j === i ? { ...x, qty: v } : x)); }} />
                  <Button size="sm" variant="destructive" onClick={() => setOutputs((xs) => xs.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Mermas</Label>
              <Button size="sm" variant="secondary" onClick={() => setWastes((xs) => [...xs, { meters: 0, reason: "" }])}>+ Merma</Button>
            </div>
            <div className="space-y-2">
              {wastes.map((w, i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                  <Input type="number" min={0} placeholder="Metros" value={w.meters || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setWastes((xs) => xs.map((x, j) => j === i ? { ...x, meters: v } : x)); }} />
                  <Input placeholder="Motivo" value={w.reason} onChange={(e) => setWastes((xs) => xs.map((x, j) => j === i ? { ...x, reason: e.target.value } : x))} />
                  <Button size="sm" variant="destructive" onClick={() => setWastes((xs) => xs.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {productId && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div>Materia prima disponible: <strong>{raw.meters.toFixed(0)} m</strong> (costo/m {currency(raw.avgCostPerMeter, 4)})</div>
              <div>Metros a consumir: <strong className={totalMeters > raw.meters ? "text-destructive" : ""}>{totalMeters} m</strong> ({outputMeters} m producción + {wasteMeters} m merma)</div>
              <div>Unidades terminadas: <strong>{totalUnits}</strong></div>
              <div>Costo film: {currency(filmCost)} · Costo tubos: {currency(tubesCost)} · <strong>Total: {currency(totalCost)}</strong></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-success text-success-foreground hover:opacity-90"
            onClick={() => {
              if (!productId) { toast.error("Elegí producto"); return; }
              const ok = onSave({ productId, date, outputs, wastes, notes: notes.trim() || undefined });
              if (ok) { setProductId(""); setOutputs([{ meters: 0, qty: 1 }]); setWastes([]); setNotes(""); }
            }}>
            Registrar producción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Stock terminado --------------------

function FinishedStockTab() {
  const products = useStore((s) => s.products);
  const lots = useStockStore((s) => s.finishedLots);
  const rows = useMemo(() => {
    const map = new Map<string, { productId: string; meters: number; qty: number; costSum: number }>();
    for (const l of lots) {
      const k = `${l.productId}::${l.meters}`;
      const cur = map.get(k) ?? { productId: l.productId, meters: l.meters, qty: 0, costSum: 0 };
      cur.qty += l.qty;
      cur.costSum += l.qty * l.unitCost;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.productId.localeCompare(b.productId) || a.meters - b.meters);
  }, [lots]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-4 py-2 text-sm font-semibold">Productos terminados</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Medida</TableHead>
            <TableHead>Unidades</TableHead>
            <TableHead>Costo unit. promedio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Todavía no producjiste unidades terminadas.</TableCell></TableRow>
          )}
          {rows.map((r) => {
            const p = products.find((x) => x.id === r.productId);
            return (
              <TableRow key={r.productId + r.meters}>
                <TableCell><strong>{p?.name ?? "?"}</strong></TableCell>
                <TableCell>{r.meters} m</TableCell>
                <TableCell>
                  {r.qty > 0 ? <Badge className="bg-success text-success-foreground">{r.qty}</Badge> : <Badge variant="destructive">0</Badge>}
                </TableCell>
                <TableCell>{currency(r.qty > 0 ? r.costSum / r.qty : 0)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

// -------------------- Tubos --------------------

function TubesTab() {
  const tubes = useStockStore((s) => s.tubes);
  const add = useStockStore((s) => s.addTube);
  const upd = useStockStore((s) => s.updateTube);
  const del = useStockStore((s) => s.deleteTube);
  const [editing, setEditing] = useState<Tube | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tubos de cartón</h3>
        <Button onClick={() => setCreating(true)}>+ Nuevo tubo</Button>
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rango (m)</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tubes.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <strong>{t.name}</strong>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                </TableCell>
                <TableCell>{t.minMeters} – {t.maxMeters === 0 ? "∞" : t.maxMeters}</TableCell>
                <TableCell>{currency(t.cost)}</TableCell>
                <TableCell>
                  <Input type="number" className="h-7 w-20" value={t.stock} onChange={(e) => upd(t.id, { stock: parseInt(e.target.value) || 0 })} />
                </TableCell>
                <TableCell>
                  {t.active ? <Badge className="bg-success text-success-foreground">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>✏️</Button>
                  <Button size="sm" variant="destructive" onClick={() => { del(t.id); toast.success("Tubo eliminado"); }}>🗑️</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <TubeDialog
        open={creating || !!editing}
        tube={editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSave={(data) => {
          if (editing) { upd(editing.id, data); toast.success("Tubo actualizado"); }
          else { add({ ...data, stock: 0 }); toast.success("Tubo creado"); }
          setCreating(false); setEditing(null);
        }}
      />
    </div>
  );
}

function TubeDialog({ open, tube, onOpenChange, onSave }: {
  open: boolean;
  tube: Tube | null;
  onOpenChange: (o: boolean) => void;
  onSave: (d: Omit<Tube, "id" | "createdAt" | "stock"> & { stock?: number }) => void;
}) {
  const [name, setName] = useState(tube?.name ?? "");
  const [description, setDescription] = useState(tube?.description ?? "");
  const [cost, setCost] = useState(String(tube?.cost ?? ""));
  const [minM, setMinM] = useState(String(tube?.minMeters ?? 0));
  const [maxM, setMaxM] = useState(String(tube?.maxMeters ?? 0));
  const [active, setActive] = useState(tube?.active ?? true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={tube?.id ?? "new"}>
        <DialogHeader><DialogTitle>{tube ? "Editar tubo" : "Nuevo tubo"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim(), description: description.trim() || undefined, cost: parseFloat(cost) || 0, minMeters: parseFloat(minM) || 0, maxMeters: parseFloat(maxM) || 0, active });
        }}>
          <div>
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Costo *</Label>
              <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required />
            </div>
            <div>
              <Label>Metros mín.</Label>
              <Input type="number" min={0} value={minM} onChange={(e) => setMinM(e.target.value)} />
            </div>
            <div>
              <Label>Metros máx. (0 = ∞)</Label>
              <Input type="number" min={0} value={maxM} onChange={(e) => setMaxM(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} /> Activo
          </label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-success text-success-foreground hover:opacity-90">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Configuración --------------------

function SettingsTab() {
  const settings = useStockStore((s) => s.settings);
  const upd = useStockStore((s) => s.updateSettings);
  const [meters, setMeters] = useState(String(settings.defaultMetersPerBobbin));
  const [waste, setWaste] = useState(String(settings.defaultWasteMeters));
  const [extra, setExtra] = useState(String(settings.extraCostPerUnit));
  const [sizes, setSizes] = useState(settings.standardSizes.join(", "));

  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-lg font-semibold">Configuración del módulo de stock</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Metros por bobina jumbo (por defecto)</Label>
          <Input type="number" value={meters} onChange={(e) => setMeters(e.target.value)} />
        </div>
        <div>
          <Label>Merma sugerida por producción (m)</Label>
          <Input type="number" value={waste} onChange={(e) => setWaste(e.target.value)} />
        </div>
        <div>
          <Label>Costo extra por unidad producida</Label>
          <Input type="number" step="0.01" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </div>
        <div>
          <Label>Medidas estándar (metros, separadas por coma)</Label>
          <Input value={sizes} onChange={(e) => setSizes(e.target.value)} />
        </div>
      </div>
      <Button className="bg-success text-success-foreground hover:opacity-90"
        onClick={() => {
          upd({
            defaultMetersPerBobbin: parseFloat(meters) || 5000,
            defaultWasteMeters: parseFloat(waste) || 0,
            extraCostPerUnit: parseFloat(extra) || 0,
            standardSizes: sizes.split(",").map((s) => parseFloat(s.trim())).filter((n) => n > 0),
          });
          toast.success("Configuración guardada");
        }}>Guardar cambios</Button>
      <p className="text-xs text-muted-foreground">
        Los costos históricos de producciones y ventas ya registradas se conservan. Solo las próximas producciones usarán los nuevos valores.
      </p>

      <div className="space-y-2 rounded-md border border-border p-3">
        <h4 className="text-sm font-semibold">Sincronización con la nube</h4>
        <p className="text-xs text-muted-foreground">
          El stock se sincroniza automáticamente entre la PC y el celular. Si algún
          dispositivo quedó desactualizado, forzá la dirección correcta.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const { forcePullStock } = await import("@/lib/stockSync");
              await forcePullStock();
            }}
          >
            Bajar de la nube
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const { forcePushStock } = await import("@/lib/stockSync");
              await forcePushStock();
            }}
          >
            Subir este dispositivo
          </Button>
        </div>
      </div>
    </Card>
  );
}

export { finishedStockFor, computeRawStock, pickTubeForMeters };
