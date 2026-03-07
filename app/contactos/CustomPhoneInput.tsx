"use client";

// ============================================================================
// app/contactos/CustomPhoneInput.tsx — Campo de Teléfono Internacional Custom
//
// @role: Agente de Frontend
// @spec: Micro-Spec 2.5 — Prefijo visual premium (sin selector nativo del SO)
//
// ESTRUCTURA (por orden visual en el DOM):
//   ┌─ EXTERIOR ────────────────────────────────────────────────────────────┐
//   │  🇪🇸 España                (indicador visual: bandera + nombre)       │
//   └───────────────────────────────────────────────────────────────────────┘
//   ┌─ INTERIOR (input group unificado) ────────────────────────────────────┐
//   │  [ 🇪🇸 +34 ▾ ] │ [  input type="tel"  ______________________ ]       │
//   └───────────────────────────────────────────────────────────────────────┘
//
// LÓGICA MÁGICA: al seleccionar un país del combobox interno, se inyecta
// automáticamente el prefijo (+XX) en el input de texto y se actualiza
// el indicador exterior con la bandera y el nombre del país.
// ============================================================================

import { useState, useRef, useEffect, useMemo } from "react";
import { getCountries, parsePhoneNumberFromString } from "libphonenumber-js";
import { getCountryCallingCode } from "react-phone-number-input";
import type { CountryCode } from "libphonenumber-js";

// ─── Datos estáticos (calculados UNA sola vez, fuera del ciclo de render) ────

const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

const ALL_COUNTRIES = getCountries()
  .map((code) => ({
    code:        code as CountryCode,
    name:        regionNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code as CountryCode),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomPhoneInputProps {
  value:          string;
  onChange:       (value: string) => void;
  error?:         string;
  defaultCountry?: CountryCode;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CustomPhoneInput({
  value,
  onChange,
  error,
  defaultCountry = "ES",
}: CustomPhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");

  const groupRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Datos derivados ───────────────────────────────────────────────────────

  const selected = useMemo(
    () => ALL_COUNTRIES.find((c) => c.code === country),
    [country]
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

  // ─── Validez en tiempo real ────────────────────────────────────────────────

  const phoneValidity: "valid" | "invalid" | "empty" = useMemo(() => {
    if (!value.trim()) return "empty";
    try {
      const parsed = parsePhoneNumberFromString(value);
      return parsed?.isValid() ? "valid" : "invalid";
    } catch {
      return "invalid";
    }
  }, [value]);

  // ─── Lógica mágica: inyecta prefijo al cambiar de país ────────────────────

  function handleCountrySelect(code: CountryCode) {
    const callingCode  = getCountryCallingCode(code);
    const numberPart   = value.replace(/^\+\d+\s*/, "").trim();
    const newValue     = numberPart
      ? `+${callingCode} ${numberPart}`
      : `+${callingCode} `;

    onChange(newValue);
    setCountry(code);
    setOpen(false);
    setQuery("");
  }

  // ─── Auto-detección de país al escribir el prefijo ────────────────────────

  function handlePhoneChange(val: string) {
    onChange(val);
    if (val.startsWith("+")) {
      try {
        const parsed = parsePhoneNumberFromString(val);
        if (parsed?.country && parsed.country !== country) {
          setCountry(parsed.country as CountryCode);
        }
      } catch { /* no-op */ }
    }
  }

  // ─── Eventos globales ──────────────────────────────────────────────────────

  // Cerrar al hacer clic fuera del grupo
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Enfocar el buscador al abrir
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={groupRef} className="space-y-2">

      {/* ════════════════════════════════════════════════════════════════════
          EXTERIOR — Indicador visual: nombre del país seleccionado
          ════════════════════════════════════════════════════════════════════ */}
      <p className="text-sm text-zinc-400">
        {selected?.name ?? "Selecciona un país"}
      </p>

      {/* ════════════════════════════════════════════════════════════════════
          INTERIOR — Input group: [Buscador de prefijo] | [Input tel]
          Todo parece UN solo campo gracias al border compartido.
          ════════════════════════════════════════════════════════════════════ */}
      <div
        className={`relative flex rounded-lg border bg-zinc-900 transition-colors focus-within:ring-1 ${
          error
            ? "border-red-600/60 focus-within:border-red-500 focus-within:ring-red-500/30"
            : "border-zinc-700 focus-within:border-orange-500/60 focus-within:ring-orange-500/30"
        }`}
      >
        {/* ── Izquierda: Botón de prefijo + Dropdown buscable ── */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Seleccionar país"
            className="flex h-full w-14 shrink-0 items-center justify-center gap-1 border-r border-zinc-700 bg-transparent text-zinc-100 outline-none transition-colors hover:bg-zinc-800"
          >
            <img
              src={`https://flagcdn.com/w20/${country.toLowerCase()}.png`}
              srcSet={`https://flagcdn.com/w40/${country.toLowerCase()}.png 2x`}
              width="20"
              alt={country}
              className="rounded-sm object-cover"
            />
            <svg
              className={`h-2.5 w-2.5 shrink-0 text-zinc-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown buscable */}
          {open && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-68 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/50">
              {/* Campo de búsqueda */}
              <div className="border-b border-zinc-800 p-2">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  placeholder="Buscar país o prefijo…"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
                />
              </div>

              {/* Lista de países */}
              <ul className="max-h-52 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-3 text-center text-xs text-zinc-500">
                    Sin resultados
                  </li>
                ) : (
                  filtered.map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => handleCountrySelect(c.code)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                          c.code === country ? "text-orange-400" : "text-zinc-300"
                        }`}
                      >
                        <img
                          src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`}
                          srcSet={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png 2x`}
                          width="16"
                          alt={c.code}
                          className="rounded-sm object-cover"
                        />
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

        {/* ── Derecha: Input de texto del número ── */}
        <input
          type="tel"
          value={value}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={`+${selected?.callingCode ?? "34"} 600 000 000`}
          className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none"
        />

        {/* ── Indicador visual de validez ── */}
        {phoneValidity !== "empty" && (
          <div className="flex items-center pr-3">
            {phoneValidity === "valid" ? (
              <span
                title="Número válido"
                className="h-2 w-2 rounded-full bg-emerald-500"
              />
            ) : (
              <span
                title="Número incompleto o inválido para el país seleccionado"
                className="h-2 w-2 rounded-full bg-amber-500"
              />
            )}
          </div>
        )}
      </div>

      {/* Error inline */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
