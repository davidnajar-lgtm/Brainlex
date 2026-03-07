"use client";

// ============================================================================
// app/contactos/ContactosClient.tsx — Directorio interactivo con tabs y búsqueda
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.6 — Segmentación profesional del Directorio de Contactos
//
// RENDIMIENTO: los datos se cargan UNA sola vez en el RSC padre.
// Tabs + búsqueda filtran sobre el array en memoria (<1ms). Zero DB queries.
// ============================================================================

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { Contacto, ContactoStatus, ContactoTipo } from "@prisma/client";
import { DeleteButton } from "./DeleteButton";
import { Shield, Search, Archive } from "lucide-react";
import { DataHealthCircle } from "./DataHealthCircle";
import { calcDataHealth } from "@/lib/utils/dataHealth";
import { searchInQuarantine, type QuarantineHit } from "@/lib/actions/contactos.actions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = "todos" | "clientes" | "preclientes" | "contactos" | "facturadoras" | "activos" | "inactivos";

const TABS: { key: Tab; label: string }[] = [
  { key: "todos",        label: "Todos" },
  { key: "clientes",     label: "Clientes" },
  { key: "preclientes",  label: "Pre-clientes" },
  { key: "contactos",    label: "Contactos" },
  { key: "facturadoras", label: "Matrices" },
  { key: "activos",      label: "Activos" },
  { key: "inactivos",    label: "Inactivos" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayName(c: Contacto): string {
  if (c.tipo === ContactoTipo.PERSONA_JURIDICA) return c.razon_social ?? "—";
  return [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(" ") || "—";
}

function getFiscalId(c: Contacto): string {
  if (!c.fiscal_id) return "—";
  return c.fiscal_id_tipo ? `${c.fiscal_id_tipo} ${c.fiscal_id}` : c.fiscal_id;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status, isActive }: { status: ContactoStatus; isActive: boolean }) {
  if (status === ContactoStatus.ACTIVE && !isActive) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 bg-zinc-700/40 text-zinc-400 ring-zinc-600/30">
        Inactivo
      </span>
    );
  }
  const map: Record<ContactoStatus, { label: string; className: string }> = {
    ACTIVE:     { label: "Activo",     className: "bg-orange-500/10 text-orange-400 ring-orange-500/20" },
    QUARANTINE: { label: "Cuarentena", className: "bg-amber-500/10 text-amber-400 ring-amber-500/20" },
    FORGOTTEN:  { label: "Olvidado",   className: "bg-zinc-700/40 text-zinc-500 ring-zinc-600/20" },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${className}`}>
      {label}
    </span>
  );
}

function RoleBadges({ c }: { c: Contacto }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {c.es_facturadora && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 bg-violet-500/15 text-violet-300 ring-violet-500/40">
          <Shield className="h-2.5 w-2.5" />
          Matriz
        </span>
      )}
      {c.es_cliente && !c.es_facturadora && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
          Cliente
        </span>
      )}
      {(c as Contacto & { es_precliente: boolean }).es_precliente && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-blue-500/10 text-blue-400 ring-blue-500/20">
          Pre-cliente
        </span>
      )}
      {!c.es_cliente && !(c as Contacto & { es_precliente: boolean }).es_precliente && !c.es_facturadora && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-zinc-700/60 text-zinc-300 ring-zinc-500/50">
          Contacto
        </span>
      )}
    </div>
  );
}

// ─── Tabla ────────────────────────────────────────────────────────────────────

function ContactosTable({ contactos }: { contactos: Contacto[] }) {
  if (contactos.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 text-center">
        <p className="text-sm text-zinc-500">No hay contactos que coincidan con el filtro.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      {/* Cabecera */}
      <div className="grid grid-cols-[1fr_9rem_6rem_6rem_2rem_4rem] md:grid-cols-[1fr_9rem_15rem_9rem_6rem_6rem_2rem_4rem] gap-x-4 border-b border-zinc-800 bg-zinc-900 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <span>Nombre / Razón Social</span>
        <span>NIF</span>
        <span className="hidden md:block">Email</span>
        <span className="hidden md:block">Teléfono</span>
        <span className="text-right">Rol</span>
        <span>Estado</span>
        <span className="text-center" title="Completitud de ficha">%</span>
        <span />
      </div>

      {/* Filas */}
      <div className="divide-y divide-zinc-800/60 bg-zinc-950">
        {contactos.map((c) => {
          const ext        = c as Contacto & { es_precliente: boolean; is_active: boolean };
          const isMatriz   = c.es_facturadora;
          const isCliente  = c.es_cliente && !isMatriz;
          const isPrec     = ext.es_precliente;
          const isInactive = !ext.is_active;
          const health     = calcDataHealth(c);
          const rowAccent  = isMatriz  ? "border-l-2 border-l-violet-500/60 bg-violet-500/[0.025]"
                           : isCliente ? "border-l-2 border-l-emerald-500/50 bg-emerald-500/[0.018]"
                           : isPrec    ? "border-l-2 border-l-blue-500/40   bg-blue-500/[0.015]"
                           :             "border-l-2 border-l-transparent";
          return (
            <div
              key={c.id}
              className={[
                "group relative cursor-pointer transition-colors hover:bg-zinc-900/70",
                rowAccent,
                isInactive ? "opacity-50 grayscale" : "",
              ].join(" ")}
            >
              {/* Stretched link */}
              <Link
                href={`/contactos/${c.id}`}
                className="absolute inset-0 z-10"
                aria-label={`Abrir ficha de ${getDisplayName(c)}`}
              />

              <div className="relative grid grid-cols-[1fr_9rem_6rem_6rem_2rem_4rem] md:grid-cols-[1fr_9rem_15rem_9rem_6rem_6rem_2rem_4rem] items-center gap-x-4 px-5 py-3.5">
                {/* Nombre */}
                <div className="flex min-w-0 items-center gap-2">
                  {isMatriz && (
                    <Shield className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                  )}
                  <span className={`truncate text-sm font-medium ${
                    isMatriz  ? "text-violet-200 font-semibold"
                    : isCliente ? "text-emerald-300"
                    : isPrec    ? "text-blue-300"
                    :             "text-zinc-100"
                  }`}>
                    {getDisplayName(c)}
                  </span>
                </div>

                {/* NIF */}
                <span className="font-mono text-xs text-zinc-400 whitespace-nowrap">
                  {getFiscalId(c)}
                </span>

                {/* Email */}
                <span className="hidden truncate text-xs text-zinc-400 md:block">
                  {c.email_principal ?? <span className="text-zinc-600">—</span>}
                </span>

                {/* Teléfono favorito */}
                <span className="hidden font-mono text-xs text-zinc-400 whitespace-nowrap md:block">
                  {c.telefono_movil ?? c.telefono_fijo ?? <span className="text-zinc-600">—</span>}
                </span>

                {/* Roles */}
                <RoleBadges c={c} />

                {/* Estado */}
                <StatusBadge status={c.status} isActive={ext.is_active} />

                {/* Health */}
                <div className="flex justify-center">
                  <DataHealthCircle score={health} size={28} strokeWidth={3} showLabel={false} />
                </div>

                {/* Acciones — z-20, por encima del stretched link */}
                <div className="relative z-20 flex items-center justify-end gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <a
                    href={`/contactos/${c.id}/editar`}
                    className="text-xs font-medium text-zinc-500 transition-colors hover:text-orange-400"
                  >
                    Editar
                  </a>
                  {!isMatriz && <DeleteButton id={c.id} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ContactosClient({ contactos }: { contactos: Contacto[] }) {
  const [tab,   setTab]   = useState<Tab>("todos");
  const [query, setQuery] = useState("");

  // ── Visión de Rayos X: búsqueda en cuarentena ─────────────────────────────
  const [quarantineHit,  setQuarantineHit]  = useState<QuarantineHit | null>(null);
  const [, startQSearch] = useTransition();

  // Conteos por tab (calculados una sola vez por render del array completo)
  const counts = useMemo(() => {
    const list = contactos as (Contacto & { es_precliente: boolean; is_active: boolean })[];
    return {
      todos:        list.length,
      clientes:     list.filter(c =>  c.es_cliente && !c.es_facturadora).length,
      preclientes:  list.filter(c =>  c.es_precliente).length,
      contactos:    list.filter(c => !c.es_cliente && !c.es_precliente && !c.es_facturadora).length,
      facturadoras: list.filter(c =>  c.es_facturadora).length,
      activos:      list.filter(c =>  c.is_active).length,
      inactivos:    list.filter(c => !c.is_active).length,
    };
  }, [contactos]);

  // Filtrado en memoria: tab + búsqueda (<1ms para < 5.000 registros)
  const filtered = useMemo(() => {
    const list = contactos as (Contacto & { es_precliente: boolean })[];

    const ext = list as (Contacto & { es_precliente: boolean; is_active: boolean })[];
    let result: typeof ext = ext;
    switch (tab) {
      case "clientes":     result = ext.filter(c =>  c.es_cliente && !c.es_facturadora); break;
      case "preclientes":  result = ext.filter(c =>  c.es_precliente); break;
      case "contactos":    result = ext.filter(c => !c.es_cliente && !c.es_precliente && !c.es_facturadora); break;
      case "facturadoras": result = ext.filter(c =>  c.es_facturadora); break;
      case "activos":      result = ext.filter(c =>  c.is_active); break;
      case "inactivos":    result = ext.filter(c => !c.is_active); break;
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(c => {
        const name   = getDisplayName(c).toLowerCase();
        const fiscal = (c.fiscal_id ?? "").toLowerCase();
        const email  = (c.email_principal ?? "").toLowerCase();
        return name.includes(q) || fiscal.includes(q) || email.includes(q);
      });
    }

    // Facturadoras siempre fijadas arriba, resto mantiene orden original
    return [...result].sort((a, b) => {
      if (a.es_facturadora && !b.es_facturadora) return -1;
      if (!a.es_facturadora && b.es_facturadora) return 1;
      return 0;
    });
  }, [contactos, tab, query]);

  // Rayos X: solo se dispara cuando no hay resultados activos y la query es útil
  useEffect(() => {
    if (filtered.length > 0 || !query.trim() || query.trim().length < 3) {
      setQuarantineHit(null);
      return;
    }
    const timer = setTimeout(() => {
      startQSearch(async () => {
        const res = await searchInQuarantine(query.trim());
        setQuarantineHit(res.ok && res.hit ? res.hit : null);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [query, filtered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* ── Barra superior: Tabs + Buscador ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        {/* Tabs / Pills */}
        <div className="flex flex-wrap gap-1">
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            const count  = counts[key];
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? key === "facturadoras"
                      ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                      : key === "clientes"
                      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                      : key === "preclientes"
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                      : key === "activos" || key === "inactivos"
                      ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30"
                      : "bg-zinc-700/60 text-zinc-300 ring-1 ring-zinc-500/50"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? "bg-white/10 text-inherit" : "bg-zinc-800 text-zinc-600"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, NIF o email…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 sm:w-64"
          />
        </div>
      </div>

      {/* Contador de resultados */}
      <p className="text-xs text-zinc-600">
        {filtered.length} contacto{filtered.length !== 1 ? "s" : ""}
        {query.trim() ? ` · "${query.trim()}"` : ""}
        {tab !== "todos" ? ` en ${TABS.find(t => t.key === tab)?.label}` : ""}
      </p>

      {/* ── Banner Rayos X: resultado en cuarentena ── */}
      {quarantineHit && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-2.5 text-xs">
          <Archive className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-amber-400">
            Sin resultados activos. Encontrado en el{" "}
            <span className="font-semibold">Archivo de Cuarentena</span>:{" "}
            <span className="text-amber-200">{quarantineHit.name}</span>
            {quarantineHit.fiscal_id && (
              <span className="ml-1 text-amber-600">({quarantineHit.fiscal_id})</span>
            )}
          </span>
          <Link
            href={`/contactos/${quarantineHit.id}`}
            className="ml-auto shrink-0 font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-100"
          >
            Ver y Recuperar →
          </Link>
        </div>
      )}

      <ContactosTable contactos={filtered} />
    </div>
  );
}
