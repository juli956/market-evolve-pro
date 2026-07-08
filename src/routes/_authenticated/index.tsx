import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ShoppingCart,
  Package,
  History as HistoryIcon,
  LineChart,
  Users,
  Truck,
  DatabaseBackup,
  Boxes,
  LogOut,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { Dashboard } from "@/components/app/Dashboard";
import { NewSale } from "@/components/app/NewSale";
import { Products } from "@/components/app/Products";
import { History } from "@/components/app/History";
import { Metrics } from "@/components/app/Metrics";
import { BackupPanel } from "@/components/app/BackupPanel";
import { Contacts } from "@/components/app/Contacts";
import { Stock } from "@/components/app/Stock";
import { supabase } from "@/integrations/supabase/client";
import { setSyncUser } from "@/lib/cloudSync";
import { useTheme } from "@/hooks/use-theme";
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

type Tab =
  | "dashboard"
  | "sales"
  | "products"
  | "stock"
  | "history"
  | "metrics"
  | "clients"
  | "providers"
  | "backup";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", Icon: BarChart3 },
  { id: "sales", label: "Nueva Venta", Icon: ShoppingCart },
  { id: "products", label: "Productos", Icon: Package },
  { id: "stock", label: "Stock", Icon: Boxes },
  { id: "history", label: "Historial", Icon: HistoryIcon },
  { id: "metrics", label: "Métricas", Icon: LineChart },
  { id: "clients", label: "Clientes", Icon: Users },
  { id: "providers", label: "Proveedores", Icon: Truck },
  { id: "backup", label: "Respaldos", Icon: DatabaseBackup },
];

function HomePage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();
  useTheme();

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
                <BarChart3 className="h-6 w-6" />
                Gestor de Ventas Pro
              </h1>
              <p className="mt-1 text-sm opacity-80">
                Controlá tus ventas, ganancias y stock
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs opacity-90">
              {email && (
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  <UserIcon className="h-3.5 w-3.5" />
                  {email}
                </span>
              )}
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 font-medium text-white transition-colors hover:bg-white/20"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-[2px] bg-nav">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={
                  "inline-flex min-w-max flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-nav-foreground transition-colors " +
                  (active ? "bg-nav-active" : "bg-nav hover:bg-nav-active/70")
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <main key={tab} className="animate-in fade-in duration-300 p-4 sm:p-6">
          {tab === "dashboard" && <Dashboard />}
          {tab === "sales" && <NewSale />}
          {tab === "products" && <Products />}
          {tab === "history" && <History />}
          {tab === "metrics" && <Metrics />}
          {tab === "clients" && <Contacts kind="client" />}
          {tab === "providers" && <Contacts kind="provider" />}
          {tab === "backup" && <BackupPanel />}
        </main>
      </div>
    </div>
  );
}
