import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useStore } from "@/lib/store";
import type { Client, Provider } from "@/lib/types";
import { currencyShort } from "@/lib/utils-app";
import { toast } from "sonner";

type Kind = "client" | "provider";

interface Props {
  kind: Kind;
}

export function Contacts({ kind }: Props) {
  const store = useStore();
  const items = kind === "client" ? store.clients : store.providers;
  const add = kind === "client" ? store.addClient : store.addProvider;
  const update = kind === "client" ? store.updateClient : store.updateProvider;
  const remove = kind === "client" ? store.deleteClient : store.deleteProvider;
  const sales = store.sales;
  const products = store.products;

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Client | Provider | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Client | Provider | null>(null);

  const stats = useMemo(() => {
    // Para clientes: total y cantidad de ventas por nombre.
    // Para proveedores: cantidad de productos por proveedor.
    if (kind === "client") {
      const acc: Record<string, { total: number; count: number; last?: string }> = {};
      sales.forEach((s) => {
        const key = (s.client || "").trim().toLowerCase();
        if (!key) return;
        if (!acc[key]) acc[key] = { total: 0, count: 0 };
        acc[key].total += s.total;
        acc[key].count += 1;
        if (!acc[key].last || s.date > acc[key].last!) acc[key].last = s.date;
      });
      return acc;
    } else {
      const acc: Record<string, { count: number; stock: number }> = {};
      products.forEach((p) => {
        const key = (p.provider || "").trim().toLowerCase();
        if (!key) return;
        if (!acc[key]) acc[key] = { count: 0, stock: 0 };
        acc[key].count += 1;
        acc[key].stock += p.stock ?? 0;
      });
      return acc;
    }
  }, [kind, sales, products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items
      .filter(
        (c) =>
          !term ||
          c.name.toLowerCase().includes(term) ||
          (c.email ?? "").toLowerCase().includes(term) ||
          (c.phone ?? "").toLowerCase().includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, q]);

  const label = kind === "client" ? "cliente" : "proveedor";
  const labelPlural = kind === "client" ? "Clientes" : "Proveedores";
  const icon = kind === "client" ? "👥" : "🏭";

  function submit(data: { name: string; phone?: string; email?: string; notes?: string }) {
    if (!data.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (editing) {
      update(editing.id, data);
      toast.success(`${labelPlural.slice(0, -1)} actualizado`);
    } else {
      add(data);
      toast.success(`${labelPlural.slice(0, -1)} creado`);
    }
    setEditing(null);
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">
          {icon} {labelPlural} ({items.length})
        </h3>
        <Button
          onClick={() => setCreating(true)}
          className="bg-primary text-primary-foreground hover:opacity-90"
        >
          + Nuevo {label}
        </Button>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Buscar ${label}...`}
      />

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? `Todavía no cargaste ${label}s. Creá el primero.`
            : "Sin resultados para tu búsqueda."}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const key = c.name.trim().toLowerCase();
            const st = stats[key];
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    {c.phone && (
                      <div className="text-xs text-muted-foreground">📞 {c.phone}</div>
                    )}
                    {c.email && (
                      <div className="text-xs text-muted-foreground">✉️ {c.email}</div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(c)}
                      className="rounded px-2 py-1 text-xs text-info hover:bg-info/10"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setToDelete(c)}
                      className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      title="Eliminar"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {c.notes && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.notes}</p>
                )}

                {kind === "client" && st && (
                  <div className="mt-3 flex items-center justify-between rounded bg-muted/60 px-3 py-2 text-xs">
                    <span>
                      <strong className="text-success">
                        {currencyShort((st as { total: number }).total)}
                      </strong>{" "}
                      · {(st as { count: number }).count} ventas
                    </span>
                    {(st as { last?: string }).last && (
                      <span className="text-muted-foreground">
                        últ. {(st as { last?: string }).last}
                      </span>
                    )}
                  </div>
                )}
                {kind === "provider" && st && (
                  <div className="mt-3 rounded bg-muted/60 px-3 py-2 text-xs">
                    <strong>{(st as { count: number }).count}</strong> producto(s) ·{" "}
                    <strong>{(st as { stock: number }).stock}</strong> u. en stock
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ContactDialog
        open={creating || !!editing}
        initial={editing}
        title={editing ? `Editar ${label}` : `Nuevo ${label}`}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={submit}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {label}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que querés eliminar a <strong>{toDelete?.name}</strong>? Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (toDelete) {
                  remove(toDelete.id);
                  toast.success(`${labelPlural.slice(0, -1)} eliminado`);
                  setToDelete(null);
                }
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

function ContactDialog({
  open,
  initial,
  title,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: Client | Provider | null;
  title: string;
  onClose: () => void;
  onSubmit: (d: { name: string; phone?: string; email?: string; notes?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Reset fields when reopened with a different initial value
  useMemoResetOnOpen(open, initial, {
    setName,
    setPhone,
    setEmail,
    setNotes,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Nombre *</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted-foreground">Teléfono</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Email</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-muted-foreground">Notas</span>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() =>
              onSubmit({
                name: name.trim(),
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper hook to sync form fields when dialog opens
function useMemoResetOnOpen(
  open: boolean,
  initial: Client | Provider | null,
  setters: {
    setName: (v: string) => void;
    setPhone: (v: string) => void;
    setEmail: (v: string) => void;
    setNotes: (v: string) => void;
  },
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (!open) return;
    setters.setName(initial?.name ?? "");
    setters.setPhone(initial?.phone ?? "");
    setters.setEmail(initial?.email ?? "");
    setters.setNotes(initial?.notes ?? "");
  }, [open, initial]);
}
