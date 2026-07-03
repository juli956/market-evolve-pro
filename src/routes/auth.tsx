import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ingresar · Gestor de Ventas Pro" },
      { name: "description", content: "Ingresá o creá tu cuenta para acceder al Gestor de Ventas Pro." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Ya podés ingresar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <header className="mb-5 rounded-lg bg-[#2c3e50] p-4 text-white">
          <h1 className="text-lg font-bold">📊 Gestor de Ventas Pro</h1>
          <p className="text-xs opacity-80">Ingresá para sincronizar tus datos</p>
        </header>
        <div className="mb-4 flex gap-1 rounded-md bg-muted p-1">
          <button
            className={`flex-1 rounded-sm py-1.5 text-sm ${mode === "signin" ? "bg-popover shadow" : ""}`}
            onClick={() => setMode("signin")}
          >
            Ingresar
          </button>
          <button
            className={`flex-1 rounded-sm py-1.5 text-sm ${mode === "signup" ? "bg-popover shadow" : ""}`}
            onClick={() => setMode("signup")}
          >
            Crear cuenta
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Contraseña</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>
          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
            {loading ? "..." : mode === "signin" ? "Ingresar" : "Crear cuenta"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
