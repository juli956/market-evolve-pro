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
import { useStore } from "@/lib/store";
import type { SaleItem } from "@/lib/types";
import { getLocalDateString, currency } from "@/lib/utils-app";

interface DraftItem {
  key: string;
  productId: string;
  qty: number;
  price: number;
}

function emptyItem(): DraftItem {
  return { key: crypto.randomUUID(), productId: "", qty: 1, price: 0 };
}

export function NewSale() {
  const products = useStore((s) => s.products);
  const clients = useStore((s) => s.clients);
  const addSale = useStore((s) => s.addSale);
  const addClient = useStore((s) => s.addClient);

  const [client, setClient] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [items, setItems] = useState<DraftItem[]>([]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);


  const { total, profit } = useMemo(() => {
    let t = 0;
    let g = 0;
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) continue;
      t += it.price * it.qty;
      g += (it.price - p.cost) * it.qty;
    }
    return { total: t, profit: g };
  }, [items, productMap]);

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

  function save() {
    const c = client.trim();
    if (!c) {
      toast.error("Ingresá el cliente");
      return;
    }
    if (!date) {
      toast.error("Seleccioná la fecha");
      return;
    }
    const finalItems: SaleItem[] = [];
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p || !it.price) continue;
      finalItems.push({
        productId: p.id,
        name: p.name,
        qty: it.qty,
        price: it.price,
        cost: p.cost,
        profit: (it.price - p.cost) * it.qty,
      });
    }
    if (finalItems.length === 0) {
      toast.error("Agregá al menos un producto con precio");
      return;
    }
    addSale({
      client: c,
      date,
      items: finalItems,
      total: finalItems.reduce((a, i) => a + i.price * i.qty, 0),
      profit: finalItems.reduce((a, i) => a + i.profit, 0),
    });
    // Auto-guardar cliente nuevo en la lista si no existe.
    const known = clients.some((x) => x.name.trim().toLowerCase() === c.toLowerCase());
    if (!known) addClient({ name: c });
    toast.success("Venta guardada");
    clear();
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
            const itemProfit = p ? (it.price - p.cost) * it.qty : 0;
            return (
              <div
                key={it.key}
                className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/40 p-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"
              >
                <div>
                  <Label className="text-xs text-muted-foreground">Producto</Label>
                  <Select
                    value={it.productId}
                    onValueChange={(v) => updateItem(it.key, { productId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
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
    </div>
  );
}
