"use client";

// ============================================================================
// components/ui/TagSelector.tsx — Selector de Etiquetas SALI
//
// @Scope-Guard: carga etiquetas filtradas por el tenant activo.
// Cuando el CEO cambia de empresa, el selector se limpia y recarga
// automáticamente gracias al efecto sobre `tenant.scope`.
//
// UI: buscador + lista agrupada por categoría (estilo Excel).
// ============================================================================

import { useState, useEffect, useTransition, useRef } from "react";
import { Check, X, Tag, Search, ChevronDown, Folder, GripVertical } from "lucide-react";
import { useTenant } from "@/lib/context/TenantContext";
import { getEtiquetasByTenant } from "@/lib/modules/entidades/actions/etiquetas.actions";
import { getCategoriaTipo } from "@/lib/config/categoriaTipos";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EtiquetaOption {
  id:          string;
  nombre:      string;
  color:       string;
  es_sistema:  boolean;
  scope:       string;
  categoria:   { id: string; nombre: string };
}

interface CategoriaGroup {
  id:        string;
  nombre:    string;
  etiquetas: EtiquetaOption[];
}

interface TagSelectorProps {
  /** IDs de etiquetas actualmente asignadas */
  value:     string[];
  /** Callback al asignar/desasignar */
  onChange:  (ids: string[]) => void;
  placeholder?: string;
  disabled?:    boolean;
}

// ─── ColorDot ─────────────────────────────────────────────────────────────────

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/10"
      style={{ backgroundColor: color }}
    />
  );
}

// ─── ScopeBadge ───────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: string }) {
  if (scope === "GLOBAL") return null;
  const label = scope === "LEXCONOMY" ? "LX" : "LW";
  const color = scope === "LEXCONOMY" ? "#FF8C00" : "#9B1B30";
  return (
    <span
      className="rounded-sm px-1 py-0.5 text-[9px] font-bold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  );
}

function CategoriaTipoIcon({ categoriaNombre }: { categoriaNombre: string }) {
  const tipo = getCategoriaTipo(categoriaNombre);
  return tipo === "CONSTRUCTOR" ? (
    <Folder className="h-3 w-3 shrink-0 text-amber-500/60" />
  ) : (
    <Tag className="h-3 w-3 shrink-0 text-violet-500/60" />
  );
}

// ─── TagSelector ──────────────────────────────────────────────────────────────

export function TagSelector({
  value,
  onChange,
  placeholder = "Buscar etiquetas…",
  disabled = false,
}: TagSelectorProps) {
  const { tenant, isSuperAdmin } = useTenant();
  const [open,       setOpen]       = useState(false);
  const [query,      setQuery]      = useState("");
  const [grupos,     setGrupos]     = useState<CategoriaGroup[]>([]);
  const [isPending,  startTransition] = useTransition();
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Recargar etiquetas cuando cambia el tenant (y al montar)
  useEffect(() => {
    setQuery("");      // limpiar búsqueda al cambiar tenant
    setLoadError(null);
    startTransition(async () => {
      const res = await getEtiquetasByTenant(tenant.scope, isSuperAdmin);
      if (res.ok) setGrupos(res.data as CategoriaGroup[]);
      else        setLoadError(res.error);
    });
  }, [tenant.scope, isSuperAdmin]);

  // Cerrar al clicar fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Filtrar por búsqueda
  const filtered = grupos
    .map((g) => ({
      ...g,
      etiquetas: g.etiquetas.filter((e) =>
        e.nombre.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter((g) => g.etiquetas.length > 0);

  // Todas las etiquetas planas para resolver nombre/color de los seleccionados
  const allEtiquetas = grupos.flatMap((g) => g.etiquetas);
  const selected     = allEtiquetas.filter((e) => value.includes(e.id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ─────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex min-h-[40px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm transition-colors hover:border-zinc-700 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 disabled:opacity-50"
      >
        {selected.length === 0 ? (
          <span className="flex items-center gap-1.5 text-zinc-600">
            <Tag className="h-3.5 w-3.5" />
            {placeholder}
          </span>
        ) : (
          selected.map((e) => (
            <span
              key={e.id}
              draggable
              onDragStart={(ev) => {
                const payload = {
                  id: e.id,
                  nombre: e.nombre,
                  color: e.color,
                  categoriaNombre: e.categoria.nombre,
                  categoriaTipo: getCategoriaTipo(e.categoria.nombre),
                };
                ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
                ev.dataTransfer.effectAllowed = "copy";
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset cursor-grab active:cursor-grabbing"
              style={{ backgroundColor: `${e.color}22`, color: e.color }}
            >
              <CategoriaTipoIcon categoriaNombre={e.categoria.nombre} />
              {e.nombre}
              <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); toggle(e.id); }}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/40">
          {/* Header con tenant badge */}
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
            <span
              className="h-2 w-2 rounded-full ring-1 ring-white/10"
              style={{ backgroundColor: tenant.color }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {isSuperAdmin ? "Todos los scopes" : tenant.nombre}
            </span>
            {isPending && (
              <span className="ml-auto text-[10px] text-zinc-600 animate-pulse">Cargando…</span>
            )}
          </div>

          {/* Buscador */}
          <div className="border-b border-zinc-800 px-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-zinc-600 hover:text-zinc-400">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Lista agrupada */}
          <div className="max-h-64 overflow-y-auto py-1">
            {loadError && (
              <p className="px-3 py-4 text-center text-xs text-red-400">{loadError}</p>
            )}
            {!loadError && filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-zinc-600">
                {query ? "Sin resultados" : "Sin etiquetas disponibles"}
              </p>
            )}
            {filtered.map((grupo) => {
              const catTipo = getCategoriaTipo(grupo.nombre);
              return (
                <div key={grupo.id}>
                  <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                    <CategoriaTipoIcon categoriaNombre={grupo.nombre} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      {grupo.nombre}
                    </p>
                    <span className="text-[9px] text-zinc-700">
                      {catTipo === "CONSTRUCTOR" ? "Constructor" : "Atributo"}
                    </span>
                  </div>
                  {grupo.etiquetas.map((e) => {
                    const isSelected = value.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        draggable
                        onDragStart={(ev) => {
                          const payload = {
                            id: e.id,
                            nombre: e.nombre,
                            color: e.color,
                            categoriaNombre: e.categoria.nombre,
                            categoriaTipo: getCategoriaTipo(e.categoria.nombre),
                          };
                          ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
                          ev.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => toggle(e.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-800 cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-3 w-3 text-zinc-700 shrink-0" />
                        <ColorDot color={e.color} />
                        <span style={{ color: isSelected ? e.color : undefined }}
                          className={isSelected ? "font-medium" : "text-zinc-300"}>
                          {e.nombre}
                        </span>
                        <ScopeBadge scope={e.scope} />
                        {isSelected && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0" style={{ color: e.color }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer — seleccionados */}
          {value.length > 0 && (
            <div className="border-t border-zinc-800 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">
                {value.length} etiqueta{value.length > 1 ? "s" : ""} seleccionada{value.length > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
