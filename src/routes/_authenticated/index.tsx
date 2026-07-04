import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dashboard } from "@/components/app/Dashboard";
import { NewSale } from "@/components/app/NewSale";
import { Products } from "@/components/app/Products";
import { History } from "@/components/app/History";
import { Metrics } from "@/components/app/Metrics";
import { BackupPanel } from "@/components/app/BackupPanel";
import { Contacts } from "@/components/app/Contacts";
import { supabase } from "@/integrations/supabase/client";
import { setSyncUser } from "@/lib/cloudSync";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gestor de Ventas Pro" },
      {
        name: "description",
        content:
          "Controlá tus ventas, ganancias, stock, clientes y proveedores desde la PC o el celular.",
      },
    ],
  }),
  component: HomePage,
});


type Tab = "dashboard" | "sales" | "products" | "history" | "metrics" | "backup";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sales", label: "Nueva Venta" },
  { id: "products", label: "Productos" },
  { id: "history", label: "Historial" },
  { id: "metrics", label: "Métricas" },
  { id: "backup", label: "Respaldos" },
];

function HomePage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    setSyncUser(null);
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-border">
        <header className="bg-header px-5 py-4 text-header-foreground">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
                📊 Gestor de Ventas Pro
              </h1>
              <p className="mt-1 text-sm opacity-80">Controlá tus ventas, ganancias y stock</p>
            </div>
            <div className="flex items-center gap-3 text-xs opacity-90">
              {email && <span>👤 {email}</span>}
              <button
                onClick={signOut}
                className="rounded-md bg-white/10 px-3 py-1.5 font-medium text-white hover:bg-white/20"
              >
                Salir
              </button>
            </div>
          </div>
        </header>


        <nav className="flex flex-wrap gap-[2px] bg-nav">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "min-w-max flex-1 px-4 py-3 text-sm font-medium text-nav-foreground transition-colors " +
                  (active ? "bg-nav-active" : "bg-nav hover:bg-nav-active/70")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <main className="p-4 sm:p-6">
          {tab === "dashboard" && <Dashboard />}
          {tab === "sales" && <NewSale />}
          {tab === "products" && <Products />}
          {tab === "history" && <History />}
          {tab === "metrics" && <Metrics />}
          {tab === "backup" && <BackupPanel />}
        </main>
      </div>
    </div>
  );
}
