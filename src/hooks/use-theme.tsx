import { useEffect } from "react";

// La app usa siempre modo oscuro. Este hook se mantiene por compatibilidad
// pero solo aplica la clase "dark" al <html>.
export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return { theme: "dark" as const };
}
