// ============================================================================
// app/contactos/[id]/_components/CountrySelectorField.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Selector de País con banderas SVG (country-flag-icons)
//
// Devuelve el código ISO-2 (ej: "ES") al padre vía onChange.
// Incluye un <input type="hidden" name="pais"> para la integración con
// useActionState / FormData — no requiere cambios en la Server Action.
// ============================================================================
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { getCountries } from "libphonenumber-js";
import * as Flags from "country-flag-icons/react/3x2";

// ─── Datos de países (calculados una sola vez fuera del render) ───────────────

const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

type CountryEntry = { code: string; name: string };

// Limpia artefactos que Intl.DisplayNames puede añadir: "(ES)", " - ES", "ES" al final
function cleanCountryName(raw: string): string {
  return raw
    .replace(/\s*\([A-Z]{2}\)\s*$/, "")
    .replace(/\s*-\s*[A-Z]{2}\s*$/, "")
    .replace(/\s+[A-Z]{2}$/, "")
    .trim();
}

const ALL_COUNTRIES: CountryEntry[] = getCountries()
  .map((code) => ({
    code,
    name: cleanCountryName(regionNames.of(code) ?? code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

// ─── Helper: bandera SVG con fallback ─────────────────────────────────────────

function Flag({ code }: { code: string }) {
  const RenderFlag = (Flags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[code];
  return RenderFlag
    ? <RenderFlag className="h-3.5 w-5 shrink-0 rounded-sm border border-zinc-700/50 object-cover" />
    : <span className="text-sm leading-none">🌐</span>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CountrySelectorField({
  value,
  onChange,
  hasError,
}: {
  value:    string;
  onChange: (isoCode: string) => void;
  hasError?: boolean;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const containerRef      = useRef<HTMLDivElement>(null);
  const searchRef         = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => ALL_COUNTRIES.find((c) => c.code === value) ?? { code: value, name: value },
    [value],
  );

  const filtered = useMemo(() => {
    if (!query) return ALL_COUNTRIES;
    const q = query.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  // Cierra al hacer clic fuera
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Cierra con Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Enfoca el buscador al abrir
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Input oculto — envía el código ISO a la Server Action via FormData */}
      <input type="hidden" name="pais" value={value} />

      {/* Botón disparador */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm text-zinc-200 bg-zinc-800 transition-colors focus:outline-none ${
          hasError
            ? "border-red-500/70 hover:border-red-400"
            : "border-zinc-700 hover:border-zinc-500"
        }`}
      >
        <Flag code={selected.code} />
        <span className="truncate">{selected.name}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/40">
          {/* Buscador */}
          <div className="border-b border-zinc-800 p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
            />
          </div>

          {/* Lista */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-zinc-500">Sin resultados</li>
            ) : (
              filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => { onChange(c.code); setOpen(false); setQuery(""); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                      c.code === value ? "text-orange-400" : "text-zinc-300"
                    }`}
                  >
                    <Flag code={c.code} />
                    <span className="flex-1 text-left">{c.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
