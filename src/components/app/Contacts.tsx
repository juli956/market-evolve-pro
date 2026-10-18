import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { Client, Provider, Sale, Product } from "@/lib/types";
import { currency, currencyShort, formatDate } from "@/lib/utils-app";
import {
  computeClientStats,
  DEFAULT_THRESHOLDS,
  STATUS_INFO,
  whatsappTemplate,
  type ClientStats,
  type ClientThresholds,
} from "@/lib/client-frequency";
import { toast } from "sonner";

const THRESH_KEY = "gestor-ventas:client-thresholds:v1";

function loadThresholds(): ClientThresholds {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(THRESH_KEY) : null;
    if (raw) return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_THRESHOLDS;
}

type ClientFilter = "all" | "active" | "upcoming" | "delayed" | "inactive" | "new";
type SortBy = "name" | "last" | "freq" | "daysSince" | "delay";

const CLIENT_FILTERS: { value: ClientFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "upcoming", label: "Próximas compras" },
  { value: "delayed", label: "Demoradas" },
  { value: "inactive", label: "Inactivos" },
  { value: "new", label: "Nuevos / sin historial" },
];


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
  const [viewing, setViewing] = useState<Client | Provider | null>(null);

  // Seguimiento de frecuencia de compra (solo clientes)
  const [now, setNow] = useState(() => Date.now());
  const [thresholds, setThresholds] = useState<ClientThresholds>(loadThresholds);
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [showConfig, setShowConfig] = useState(false);

  // Recalcula los estados con el paso del tiempo (aunque no haya ventas nuevas).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const saveThresholds = (t: ClientThresholds) => {
    setThresholds(t);
    try {
      localStorage.setItem(THRESH_KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
    toast.success("Configuración de frecuencia guardada");
  };


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

  // Seguimiento de frecuencia por cliente (se recalcula con ventas y con el paso del tiempo).
  const clientStats = useMemo(() => {
    const acc: Record<string, ClientStats> = {};
    if (kind !== "client") return acc;
    items.forEach((c) => {
      acc[c.id] = computeClientStats(sales, c.name, thresholds, now);
    });
    return acc;
  }, [kind, items, sales, thresholds, now]);

  const statusCounts = useMemo(() => {
    const acc: Record<ClientFilter, number> = {
      all: items.length,
      active: 0,
      upcoming: 0,
      delayed: 0,
      inactive: 0,
      new: 0,
    };
    if (kind !== "client") return acc;
    items.forEach((c) => {
      const s = clientStats[c.id]?.status;
      if (!s) return;
      if (s === "no-sales" || s === "new") acc.new += 1;
      else acc[s] += 1;
    });
    return acc;
  }, [kind, items, clientStats]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term),
    );
    if (kind === "client") {
      if (filter !== "all") {
        list = list.filter((c) => {
          const s = clientStats[c.id]?.status;
          if (filter === "new") return s === "new" || s === "no-sales";
          return s === filter;
        });
      }
      list = [...list].sort((a, b) => {
        const sa = clientStats[a.id];
        const sb = clientStats[b.id];
        switch (sortBy) {
          case "last":
            return (sb?.lastDate ?? "").localeCompare(sa?.lastDate ?? "");
          case "freq":
            return (sa?.frequency ?? Infinity) - (sb?.frequency ?? Infinity);
          case "daysSince":
            return (sb?.daysSince ?? -1) - (sa?.daysSince ?? -1);
          case "delay":
            return (
              (sb?.daysDelayed ?? -1) - (sa?.daysDelayed ?? -1) ||
              (sb?.daysInactive ?? -1) - (sa?.daysInactive ?? -1)
            );
          default:
            return a.name.localeCompare(b.name);
        }
      });
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [items, q, kind, filter, sortBy, clientStats]);

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

      {kind === "client" && (
        <div className="flex flex-wrap items-center gap-2">
          {CLIENT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label} ({statusCounts[f.value]})
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="h-8 w-[190px] text-xs">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="last">Última compra</SelectItem>
                <SelectItem value="freq">Frecuencia de compra</SelectItem>
                <SelectItem value="daysSince">Días sin comprar</SelectItem>
                <SelectItem value="delay">Nivel de demora</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowConfig(true)}
              title="Ajustar umbrales de demora e inactividad"
            >
              ⚙ Frecuencia
            </Button>
          </div>
        </div>
      )}

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
            const cst = kind === "client" ? clientStats[c.id] : undefined;
            const statusInfo = cst ? STATUS_INFO[cst.status] : null;
            const isAlert = cst?.status === "delayed" || cst?.status === "inactive";
            return (
              <Card
                key={c.id}
                className="cursor-pointer p-4 transition-colors hover:bg-muted/40"
                onClick={() => setViewing(c)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{c.name}</span>
                      {cst && statusInfo && (
                        <span
                          title={cst.reason}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusInfo.className}`}
                        >
                          {isAlert ? "⚠ " : ""}
                          {statusInfo.label(cst)}
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <div className="text-xs text-muted-foreground">📞 {c.phone}</div>
                    )}
                    {c.email && (
                      <div className="text-xs text-muted-foreground">✉️ {c.email}</div>
                    )}
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setViewing(c)}
                      className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      title="Ver detalle"
                    >
                      👁
                    </button>
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
                        últ. {formatDate((st as { last?: string }).last)}
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

      <ContactDetailDialog
        contact={viewing}
        kind={kind}
        sales={sales}
        products={products}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(c) => {
          setViewing(null);
          setEditing(c);
        }}
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

/* -------------------- Detalle de contacto -------------------- */

function ContactDetailDialog({
  contact,
  kind,
  sales,
  products,
  onOpenChange,
  onEdit,
}: {
  contact: Client | Provider | null;
  kind: Kind;
  sales: Sale[];
  products: Product[];
  onOpenChange: (o: boolean) => void;
  onEdit: (c: Client | Provider) => void;
}) {
  const data = useMemo(() => {
    if (!contact) return null;
    const key = contact.name.trim().toLowerCase();
    if (kind === "client") {
      const mySales = sales
        .filter((s) => (s.client || "").trim().toLowerCase() === key)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      const total = mySales.reduce((a, s) => a + s.total, 0);
      const profit = mySales.reduce((a, s) => a + s.profit, 0);
      // Top productos comprados
      const prodAgg: Record<string, { qty: number; total: number }> = {};
      mySales.forEach((s) =>
        s.items.forEach((i) => {
          if (!prodAgg[i.name]) prodAgg[i.name] = { qty: 0, total: 0 };
          prodAgg[i.name].qty += i.qty;
          prodAgg[i.name].total += i.price * i.qty;
        }),
      );
      const topProducts = Object.entries(prodAgg)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5);
      return { kind: "client" as const, sales: mySales, total, profit, topProducts };
    } else {
      const myProducts = products.filter(
        (p) => (p.provider || "").trim().toLowerCase() === key,
      );
      const totalStock = myProducts.reduce((a, p) => a + (p.stock ?? 0), 0);
      const totalCostValue = myProducts.reduce((a, p) => a + (p.stock ?? 0) * p.cost, 0);
      return { kind: "provider" as const, products: myProducts, totalStock, totalCostValue };
    }
  }, [contact, kind, sales, products]);

  return (
    <Dialog open={!!contact} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {kind === "client" ? "👤" : "🏭"} {contact?.name}
          </DialogTitle>
        </DialogHeader>

        {contact && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {contact.phone && <div>📞 {contact.phone}</div>}
              {contact.email && <div>✉️ {contact.email}</div>}
              {contact.notes && (
                <div className="sm:col-span-2 rounded bg-muted/50 p-2 text-xs">
                  {contact.notes}
                </div>
              )}
            </div>

            {data.kind === "client" ? (
              <>
                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-3 text-center text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Ventas</div>
                    <div className="text-lg font-bold">{data.sales.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-lg font-bold text-info">{currency(data.total)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Ganancia</div>
                    <div className="text-lg font-bold text-success">
                      {currency(data.profit)}
                    </div>
                  </div>
                </div>

                {data.topProducts.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Productos favoritos</h4>
                    <div className="space-y-1 text-xs">
                      {data.topProducts.map(([name, agg]) => (
                        <div
                          key={name}
                          className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5"
                        >
                          <span>{name}</span>
                          <span className="text-muted-foreground">
                            {agg.qty} u. · <strong>{currency(agg.total)}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Historial de ventas</h4>
                  {data.sales.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin ventas registradas.</p>
                  ) : (
                    <div className="max-h-64 overflow-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/80">
                          <tr className="text-left">
                            <th className="px-2 py-1.5">Fecha</th>
                            <th className="px-2 py-1.5">Items</th>
                            <th className="px-2 py-1.5 text-right">Total</th>
                            <th className="px-2 py-1.5 text-right">Ganancia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.sales.map((s) => (
                            <tr key={s.id} className="border-t">
                              <td className="px-2 py-1.5">{formatDate(s.date)}</td>
                              <td className="px-2 py-1.5">{s.items.length}</td>
                              <td className="px-2 py-1.5 text-right">{currency(s.total)}</td>
                              <td className="px-2 py-1.5 text-right text-success">
                                {currency(s.profit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-3 text-center text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Productos</div>
                    <div className="text-lg font-bold">{data.products.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Stock total</div>
                    <div className="text-lg font-bold text-info">{data.totalStock}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Valor stock</div>
                    <div className="text-lg font-bold text-success">
                      {currency(data.totalCostValue)}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Productos provistos</h4>
                  {data.products.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Este proveedor todavía no tiene productos asociados.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/80">
                          <tr className="text-left">
                            <th className="px-2 py-1.5">Producto</th>
                            <th className="px-2 py-1.5 text-right">Costo</th>
                            <th className="px-2 py-1.5 text-right">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.products.map((p) => (
                            <tr key={p.id} className="border-t">
                              <td className="px-2 py-1.5">{p.name}</td>
                              <td className="px-2 py-1.5 text-right">{currency(p.cost)}</td>
                              <td className="px-2 py-1.5 text-right">{p.stock ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {contact && (
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => onEdit(contact)}
            >
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

