import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Product } from "@/lib/types";
import { currency } from "@/lib/utils-app";

export function Products() {
  const products = useStore((s) => s.products);
  const providers = useStore((s) => s.providers);
  const addProduct = useStore((s) => s.addProduct);
  const updateProduct = useStore((s) => s.updateProduct);
  const deleteProduct = useStore((s) => s.deleteProduct);
  const addProvider = useStore((s) => s.addProvider);

  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  function persist(data: {
    name: string;
    provider: string;
    cost: number;
    stock: number;
    controlStock: boolean;
  }) {
    if (editing) {
      updateProduct(editing.id, data);
      toast.success("Producto actualizado");
    } else {
      addProduct(data);
      toast.success("Producto creado");
    }
    // Registrar proveedor si es nuevo.
    const prov = data.provider.trim();
    if (prov && !providers.some((p) => p.name.trim().toLowerCase() === prov.toLowerCase())) {
      addProvider({ name: prov });
    }
    setEditing(null);
    setCreating(false);
  }


  function stockBadge(p: Product) {
    if (!p.controlStock) return <span className="text-muted-foreground">-</span>;
    const s = p.stock ?? 0;
    if (s > 10) return <Badge className="bg-success text-success-foreground">{s}</Badge>;
    if (s > 0) return <Badge className="bg-warning text-warning-foreground">{s}</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📦 Mis Productos</h3>
        <Button onClick={() => setCreating(true)}>+ Nuevo Producto</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Costo Actual</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Todavía no cargaste productos. Tocá "+ Nuevo Producto" para empezar.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <strong>{p.name}</strong>
                </TableCell>
                <TableCell>{p.provider || "-"}</TableCell>
                <TableCell>{currency(p.cost)}</TableCell>
                <TableCell>{stockBadge(p)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                      ✏️
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setPendingDelete(p)}
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

      <ProductForm
        open={creating || !!editing}
        product={editing}
        providers={providers.map((p) => p.name)}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(false);
          }
        }}
        onSave={persist}
      />


      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que querés eliminar <strong>{pendingDelete?.name}</strong>? Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={() => {
                if (pendingDelete) {
                  deleteProduct(pendingDelete.id);
                  toast.success("Producto eliminado");
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

function ProductForm({
  open,
  product,
  providers,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  product: Product | null;
  providers: string[];
  onOpenChange: (o: boolean) => void;
  onSave: (data: {
    name: string;
    provider: string;
    cost: number;
    stock: number;
    controlStock: boolean;
  }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={product?.id ?? "new"}>
        <ProductFormInner
          product={product}
          providers={providers}
          onCancel={() => onOpenChange(false)}
          onSave={onSave}
        />
      </DialogContent>
    </Dialog>
  );
}


function ProductFormInner({
  product,
  onSave,
  onCancel,
}: {
  product: Product | null;
  onCancel: () => void;
  onSave: (data: {
    name: string;
    provider: string;
    cost: number;
    stock: number;
    controlStock: boolean;
  }) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [provider, setProvider] = useState(product?.provider ?? "");
  const [cost, setCost] = useState<string>(product ? String(product.cost) : "");
  const [stock, setStock] = useState<string>(String(product?.stock ?? 0));
  const [controlStock, setControlStock] = useState(!!product?.controlStock);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{product ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
      </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = parseFloat(cost);
            if (!name.trim() || !Number.isFinite(c)) return;
            onSave({
              name: name.trim(),
              provider: provider.trim(),
              cost: c,
              stock: parseInt(stock) || 0,
              controlStock,
            });
          }}
          className="space-y-3"
        >
          <div>
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Proveedor</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Costo *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Stock (opcional)</Label>
              <Input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={controlStock}
              onCheckedChange={(v) => setControlStock(!!v)}
            />
            Controlar stock
          </label>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full bg-success text-success-foreground hover:opacity-90"
            >
              Guardar
            </Button>
          </DialogFooter>
        </form>
    </>
  );
}

