"use client";

// ============================================================================
// app/contactos/_modules/shared/SociedadCombobox.tsx — Selector Buscable de Tipo de Sociedad
//
// @role: Agente de Frontend
// @spec: Micro-Spec 2.5 — Combobox sin select nativo (compatible dark mode)
// ============================================================================

import { useState, useRef, useEffect, useMemo } from "react";
import { TIPOS_SOCIEDAD } from "@/lib/constants/sociedades";

interface SociedadComboboxProps {
  value:    string;
  onChange: (value: string) => void;
  error?:   string;
}

export function SociedadCombobox({ value, onChange, error }: SociedadComboboxProps) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  // Cierra el dropdown al hacer clic fuera
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Foco en el buscador al abrir
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return TIPOS_SOCIEDAD;
    const q = query.toLowerCase();
    return TIPOS_SOCIEDAD.filter((t) => t.toLowerCase().includes(q));
  }, [query]);

  function handleSelect(tipo: string) {
    onChange(tipo);
    setOpen(false);
    setQuery("");
  }

  const triggerBase =
    "w-full rounded-lg border px-3.5 py-2.5 text-left text-sm outline-none transition-colors bg-zinc-900";
  const triggerNormal = `${triggerBase} border-zinc-800 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30`;
  const triggerError  = `${triggerBase} border-red-600/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30`;

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${error ? triggerError : triggerNormal} flex items-center justify-between gap-2`}
      >
        <span className={value ? "text-zinc-100" : "text-zinc-600"}>
          {value || "Seleccionar…"}
        </span>
        {/* Chevron */}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
          {/* Buscador */}
          <div className="border-b border-zinc-800 px-3 py-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Buscar tipo…"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
            />
          </div>

          {/* Lista */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-600">Sin resultados</li>
            ) : (
              filtered.map((tipo) => (
                <li key={tipo}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // evita que el blur del trigger cierre antes de seleccionar
                      handleSelect(tipo);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-800 ${
                      value === tipo ? "text-orange-400" : "text-zinc-300"
                    }`}
                  >
                    {tipo}
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
