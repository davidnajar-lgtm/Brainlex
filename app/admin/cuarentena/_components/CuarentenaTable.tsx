"use client";

// ============================================================================
// app/admin/cuarentena/_components/CuarentenaTable.tsx
//
// @role: @Frontend-UX / @Scope-Guard
// @spec: FASE 13.07 — Cuarentena reactiva al cambio de tenant
//
// Client component que recibe todos los contactos en cuarentena y los filtra
// según el tenant activo. Reacciona instantáneamente al cambio de tenant.
// ============================================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Skull, CheckCircle2, Eye } from "lucide-react";
import { RestoreButton } from "@/app/contactos/_modules/ficha/RestoreButton";
import { PassAwayButton } from "./PassAwayButton";
import { useTenant } from "@/lib/context/TenantContext";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CuarentenaContact = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  razon_social: string | null;
  fiscal_id: string | null;
  fiscal_id_tipo: string | null;
  quarantine_reason: string | null;
  quarantine_expires_at: string | null; // serialized ISO
  updated_at: string; // serialized ISO
  _count: { expedientes: number };
  company_links: { company_id: string }[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysToExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getDisplayName(c: CuarentenaContact): string {
  return (
    c.razon_social ||
    [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(" ") ||
    "—"
  );
}

function DaysCounter({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-zinc-600 text-xs">Sin plazo</span>;
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400 ring-1 ring-red-500/20">
        <Skull className="h-3 w-3" />
        VENCIDO ({Math.abs(days)}d)
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/20">
        <Clock className="h-3 w-3" />
        {days}d restantes
      </span>
    );
  }
  return (
    <span className="text-xs tabular-nums text-zinc-500">
      {days}d restantes
    </span>
  );
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function CuarentenaTable({ contacts }: { contacts: CuarentenaContact[] }) {
  const { tenant, isSuperAdmin } = useTenant();
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (showAll) return contacts;
    return contacts.filter((c) => {
      // Contactos sin company_links (huérfanos) se muestran siempre
      if (!c.company_links || c.company_links.length === 0) return true;
      return c.company_links.some((l) => l.company_id === tenant.id);
    });
  }, [contacts, tenant.id, showAll]);

  return (
    <>
      {/* Counter + filter toggle */}
      <div className="flex items-center justify-between">
        <div className="shrink-0 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-center">
          <p className="text-2xl font-bold tabular-nums text-amber-400">{filtered.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
            En Cuarentena
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowAll(!showAll)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              showAll
                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
            }`}
            title={showAll ? "Mostrando todo el Holding" : `Filtrado por ${tenant.nombre}`}
          >
            <Eye className="h-3 w-3" />
            {showAll ? "Holding" : tenant.shortLabel}
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-24 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-400">
            Archivo de cuarentena vacío
          </h3>
          <p className="mt-1 text-xs text-zinc-600">
            No hay contactos en cuarentena{!showAll ? ` en ${tenant.nombre}` : ""}.
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-zinc-800 bg-zinc-900/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>Contacto / NIF</span>
            <span className="text-right">En cuarentena desde</span>
            <span className="text-right">Expira</span>
            <span className="text-center">Restaurar</span>
            <span className="text-center">Pass Away</span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {filtered.map((c) => {
              const days = daysToExpiry(c.quarantine_expires_at);
              const displayName = getDisplayName(c);

              return (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-start gap-4 bg-zinc-900/40 px-5 py-4 hover:bg-zinc-900/70 transition-colors"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/contactos/${c.id}?tab=admin`}
                      className="group inline-flex items-center gap-1 hover:underline"
                    >
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-amber-300 transition-colors truncate max-w-xs">
                        {displayName}
                      </span>
                    </Link>
                    {c.fiscal_id && (
                      <p className="font-mono text-[11px] text-zinc-500">{c.fiscal_id_tipo} · {c.fiscal_id}</p>
                    )}
                    {c.quarantine_reason && (
                      <p className="mt-1 text-[10px] leading-relaxed text-zinc-600 line-clamp-2 max-w-xs">
                        {c.quarantine_reason}
                      </p>
                    )}
                  </div>

                  <div className="pt-0.5 text-right text-xs text-zinc-500 whitespace-nowrap">
                    {formatDate(c.updated_at)}
                  </div>

                  <div className="pt-0.5 flex justify-end">
                    <DaysCounter days={days} />
                  </div>

                  <div className="flex justify-center">
                    <RestoreButton contactoId={c.id} />
                  </div>

                  <div className="flex justify-center">
                    <PassAwayButton
                      contactoId={c.id}
                      expedientesCount={c._count.expedientes}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
