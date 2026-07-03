import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/lib/store";
import type { Sale, SaleItem } from "@/lib/types";
import { currency, formatDate, computeMargin } from "@/lib/utils-app";

type SortField = "date" | "total" | "profit" | "client";
type SortDir = "asc" | "desc";

export function History() {
  const sales = useStore((s) => s.sales);
  const products = useStore((s) => s.products);
  const deleteSale = useStore((s) => s.deleteSale);
  const updateSale = useStore((s) => s.updateSale);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clientF, setClientF] = useState("");
  const [productF, setProductF] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [viewing, setViewing] = useState<Sale | null>(null);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sale | null>(null);

  const productNames = useMemo(
    () => Array.from(new Set(products.map((p) => p.name))).sort(),
    [products],
  );
  const clientNames = useMemo(
    () => Array.from(new Set(sales.map((s) => s.client))).sort(),
    [sales],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = sales.filter((s) => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      if (clientF && s.client !== clientF) return false;
      if (productF && !s.items.some((i) => i.name === productF)) return false;
      if (term) {
        const hit =
          s.client.toLowerCase().includes(term) ||
          s.items.some((i) => i.name.toLowerCase().includes(term));
        if (!hit) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortField === "date") {
        av = a.date;
        bv = b.date;
      } else if (sortField === "total") {
        av = a.total;
        bv = b.total;
      } else if (sortField === "profit") {
        av = a.profit;
        bv = b.profit;
      } else {
        av = a.client.toLowerCase();
        bv = b.client.toLowerCase();
      }
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
    return out;
  }, [sales, q, from, to, clientF, productF, sortField, sortDir]);

  function clearFilters() {
    setQ("");
    setFrom("");
    setTo("");
    setClientF("");
    setProductF("");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">📜 Historial de Ventas</h3>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label className="text-xs">Búsqueda instantánea</Label>
            <Input
              placeholder="Cliente o producto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={clientF || "__all"} onValueChange={(v) => setClientF(v === "__all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {clientNames.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Producto</Label>
            <Select value={productF || "__all"} onValueChange={(v) => setProductF(v === "__all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {productNames.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Ordenar por</Label>
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Fecha</SelectItem>
                <SelectItem value="total">Monto</SelectItem>
                <SelectItem value="profit">Ganancia</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Dirección</Label>
            <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descendente</SelectItem>
                <SelectItem value="asc">Ascendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={clearFilters}>
            Limpiar filtros
          </Button>
          <Badge variant="secondary" className="ml-auto">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Ganancia</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay ventas para los filtros actuales.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{formatDate(s.date)}</TableCell>
                <TableCell>
                  <strong>{s.client}</strong>
                </TableCell>
                <TableCell>{s.items.length} productos</TableCell>
                <TableCell>{currency(s.total)}</TableCell>
                <TableCell className="text-success">{currency(s.profit)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setViewing(s)}>
                      👁️
                    </Button>
                    <Button size="sm" onClick={() => setEditing(s)}>
                      ✏️
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setPendingDelete(s)}
                    >
                      🗑️
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <SaleDetailDialog sale={viewing} onOpenChange={(o) => !o && setViewing(null)} />

      <EditSaleDialog
        key={editing?.id ?? "none"}
        sale={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(next) => {
          if (editing) {
            updateSale(editing.id, { ...next, id: editing.id });
            toast.success("Venta actualizada");
          }
          setEditing(null);
        }}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar venta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que querés eliminar la venta a{" "}
              <strong>{pendingDelete?.client}</strong> del{" "}
              {formatDate(pendingDelete?.date)}? Se restaurará el stock si corresponde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={() => {
                if (pendingDelete) {
                  deleteSale(pendingDelete.id);
                  toast.success("Venta eliminada");
                }
                setPendingDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -------------------- Detalle -------------------- */

function SaleDetailDialog({
  sale,
  onOpenChange,
}: {
  sale: Sale | null;
  onOpenChange: (o: boolean) => void;
}) {
  const margin = sale ? computeMargin(sale.total, sale.profit) : 0;
  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de venta</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Cliente</div>
                <div className="font-semibold">{sale.client}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Fecha</div>
                <div className="font-semibold">{formatDate(sale.date)}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Ganancia</TableHead>
                    <TableHead>Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((i, idx) => {
                    const m = i.cost > 0 ? ((i.price - i.cost) / i.cost) * 100 : 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell>{i.name}</TableCell>
                        <TableCell>{i.qty}</TableCell>
                        <TableCell>{currency(i.cost)}</TableCell>
                        <TableCell>{currency(i.price)}</TableCell>
                        <TableCell className="text-success">{currency(i.profit)}</TableCell>
                        <TableCell>{m.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/60 p-3 text-sm">
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="text-lg font-bold">{currency(sale.total)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Ganancia</div>
                <div className="text-lg font-bold text-success">{currency(sale.profit)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Margen</div>
                <div className="text-lg font-bold text-info">{margin.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Editar -------------------- */

interface EditDraft {
  key: string;
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
}

function EditSaleDialog({
  sale,
  onOpenChange,
  onSave,
}: {
  sale: Sale | null;
  onOpenChange: (o: boolean) => void;
  onSave: (next: Omit<Sale, "id">) => void;
}) {
  const products = useStore((s) => s.products);

  const [client, setClient] = useState(sale?.client ?? "");
  const [date, setDate] = useState(sale?.date ?? "");
  const [items, setItems] = useState<EditDraft[]>(
    () =>
      sale?.items.map((i) => ({
        key: crypto.randomUUID(),
        productId: i.productId,
        name: i.name,
        qty: i.qty,
        price: i.price,
        cost: i.cost,
      })) ?? [],
  );

  const total = items.reduce((a, i) => a + i.price * i.qty, 0);
  const profit = items.reduce((a, i) => a + (i.price - i.cost) * i.qty, 0);

  function updateItem(key: string, patch: Partial<EditDraft>) {
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  function submit() {
    if (!client.trim() || !date || items.length === 0) {
      toast.error("Completá cliente, fecha y al menos un producto");
      return;
    }
    const finalItems: SaleItem[] = items.map((i) => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      price: i.price,
      cost: i.cost,
      profit: (i.price - i.cost) * i.qty,
    }));
    onSave({
      client: client.trim(),
      date,
      items: finalItems,
      total: finalItems.reduce((a, i) => a + i.price * i.qty, 0),
      profit: finalItems.reduce((a, i) => a + i.profit, 0),
    });
  }

  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar venta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Cliente</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.key}
                className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/40 p-3 md:grid-cols-[2fr_0.7fr_0.9fr_0.9fr_auto] md:items-end"
              >
                <div>
                  <Label className="text-xs text-muted-foreground">Producto</Label>
                  <Select
                    value={it.productId || it.name}
                    onValueChange={(v) => {
                      const p = products.find((x) => x.id === v);
                      updateItem(it.key, {
                        productId: v,
                        name: p?.name ?? it.name,
                        cost: p?.cost ?? it.cost,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={it.name} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({currency(p.cost)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cant.</Label>
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
                    value={it.cost}
                    onChange={(e) =>
                      updateItem(it.key, { cost: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Precio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={it.price}
                    onChange={(e) =>
                      updateItem(it.key, { price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (products.length === 0) {
                  toast.error("No hay productos disponibles");
                  return;
                }
                const p = products[0];
                setItems((xs) => [
                  ...xs,
                  {
                    key: crypto.randomUUID(),
                    productId: p.id,
                    name: p.name,
                    qty: 1,
                    price: 0,
                    cost: p.cost,
                  },
                ]);
              }}
            >
              + Agregar producto
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3 text-sm">
            <div>
              <div className="text-muted-foreground">Total</div>
              <div className="text-lg font-bold text-info">{currency(total)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Ganancia</div>
              <div className="text-lg font-bold text-success">{currency(profit)}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="bg-success text-success-foreground hover:opacity-90" onClick={submit}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
