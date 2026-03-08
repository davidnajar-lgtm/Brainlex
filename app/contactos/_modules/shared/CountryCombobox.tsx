"use client";

// ============================================================================
// app/contactos/_modules/shared/CountryCombobox.tsx — Buscador de País con Prefijo
//
// @role: Agente de Frontend
// @spec: Micro-Spec 2.5 — UI de prefijo internacional sin selector nativo
//
// Reemplaza el selector nativo del navegador (que no respeta el modo oscuro)
// con un combobox controlado: botón con prefijo → dropdown con <input search>.
// ============================================================================

import { useState, useRef, useEffect, useMemo } from "react";
import { getCountries } from "libphonenumber-js";
import { getCountryCallingCode } from "react-phone-number-input";
import type { CountryCode } from "libphonenumber-js";
import * as Flags from "country-flag-icons/react/3x2";

// ─── Helper: bandera SVG con fallback ─────────────────────────────────────────

function Flag({ code }: { code: string }) {
  const RenderFlag = (Flags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[code];
  return RenderFlag
    ? <RenderFlag className="h-3.5 w-5 shrink-0 rounded-sm border border-zinc-700/50 object-cover" />
    : <span className="text-xs leading-none">🌐</span>;
}

// ─── Datos de países (calculados una sola vez fuera del render) ───────────────

const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

const ALL_COUNTRIES: { code: CountryCode; name: string; callingCode: string }[] =
  getCountries()
    .map((code) => ({
      code: code as CountryCode,
      name: regionNames.of(code) ?? code,
      callingCode: getCountryCallingCode(code as CountryCode),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

// ─── Componente ───────────────────────────────────────────────────────────────

interface CountryComboboxProps {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
}

export function CountryCombobox({ value, onChange }: CountryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => ALL_COUNTRIES.find((c) => c.code === value),
    [value]
  );

  const filtered = useMemo(() => {
    if (!query) return ALL_COUNTRIES;
    const q = query.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.callingCode.includes(q) ||
        c.code.toLowerCase().includes(q)
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
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Enfoca el buscador al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Botón: muestra bandera + prefijo del país seleccionado */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        title={selected?.name}
      >
        {selected && <Flag code={selected.code} />}
        <span>+{selected?.callingCode}</span>
        <svg
          className={`h-2.5 w-2.5 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/40">
          {/* Buscador */}
          <div className="border-b border-zinc-800 p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país o prefijo…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
            />
          </div>

          {/* Lista */}
          <ul className="max-h-52 overflow-y-auto py-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-zinc-500">
                Sin resultados
              </li>
            ) : (
              filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                      c.code === value ? "text-orange-400" : "text-zinc-300"
                    }`}
                  >
                    <Flag code={c.code} />
                    <span className="flex-1 text-left">{c.name}</span>
                    <span className="font-mono text-zinc-500">+{c.callingCode}</span>
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
