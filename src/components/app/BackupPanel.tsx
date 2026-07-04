import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  downloadBackup,
  readBackupFile,
  runAutoBackup,
  listAutoBackups,
  downloadAutoBackup,
} from "@/lib/backup";
import type { BackupPayload } from "@/lib/types";
import { formatDate } from "@/lib/utils-app";

export function BackupPanel() {
  const products = useStore((s) => s.products);
  const sales = useStore((s) => s.sales);
  const clients = useStore((s) => s.clients);
  const providers = useStore((s) => s.providers);
  const replaceAll = useStore((s) => s.replaceAll);

  const [pending, setPending] = useState<BackupPayload | null>(null);
  const [autos, setAutos] = useState(() => listAutoBackups());
  const inputRef = useRef<HTMLInputElement>(null);

  // Respaldo automático diario (idempotente).
  useEffect(() => {
    runAutoBackup(products, sales, clients, providers);
    setAutos(listAutoBackups());
  }, [products, sales, clients, providers]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      setPending(data);
    } catch (err) {
      toast.error("Archivo inválido: " + (err instanceof Error ? err.message : "error"));
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-1 font-semibold">💾 Respaldos manuales</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Descargá un JSON con productos, ventas y stock. Podés restaurarlo en otra PC
          o después de reinstalar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-success text-success-foreground hover:opacity-90"
            onClick={() => {
              downloadBackup(products, sales, clients, providers);
              toast.success("Respaldo descargado");
            }}
          >
            ⬇️ Crear respaldo (JSON)
          </Button>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            ⬆️ Restaurar respaldo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 font-semibold">🕒 Respaldos automáticos</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Guardamos un snapshot diario dentro del navegador (últimos 7). Descargalos
          cuando quieras.
        </p>
        {autos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay respaldos automáticos.</p>
        ) : (
          <ul className="divide-y divide-border">
            {autos
              .slice()
              .reverse()
              .map((a) => (
                <li key={a.date} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{formatDate(a.date)}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.payload.products.length} productos · {a.payload.sales.length} ventas
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => downloadAutoBackup(a)}>
                    Descargar
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar respaldo</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a reemplazar todos los productos y ventas actuales por los del archivo:{" "}
              <strong>
                {pending?.products.length ?? 0} productos y {pending?.sales.length ?? 0} ventas
              </strong>
              . Esta acción no se puede deshacer. Se recomienda descargar antes un respaldo
              del estado actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) {
                  replaceAll({ products: pending.products, sales: pending.sales });
                  toast.success("Respaldo restaurado");
                }
                setPending(null);
              }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
