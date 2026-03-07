"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle — alterna entre tema oscuro (defecto) y tema claro.
 *
 * Persiste en localStorage["theme"] = "light" | "dark".
 * Un <script> inline en layout.tsx aplica la clase antes del primer render
 * para evitar el flash de contenido sin tema (FOUC).
 */
export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Sincronizar con la clase que el script inline aplicó en <html>
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
      title={isLight ? "Tema oscuro" : "Tema claro"}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
    >
      {isLight ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  );
}
