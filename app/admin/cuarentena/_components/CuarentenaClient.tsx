"use client";

// ============================================================================
// app/admin/cuarentena/_components/CuarentenaClient.tsx
//
// @role: @Frontend-UX / @Scope-Guard
// @spec: FASE 13.07 — Filtrado reactivo de cuarentena por tenant activo
//
// Wrapper client que filtra los contactos en cuarentena según el tenant
// activo. Si el CEO usa "Ver Holding", muestra todos.
// ============================================================================

import { useMemo, useState } from "react";
import { useTenant } from "@/lib/context/TenantContext";
import { Eye } from "lucide-react";

export type QuarantineRow = {
  id: string;
  company_links?: { company_id: string }[];
};

export function useCuarentenaFilter<T extends QuarantineRow>(contacts: T[]) {
  const { tenant, isSuperAdmin } = useTenant();
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (showAll) return contacts;
    return contacts.filter((c) => {
      if (!c.company_links || c.company_links.length === 0) return true;
      return c.company_links.some((l) => l.company_id === tenant.id);
    });
  }, [contacts, tenant.id, showAll]);

  return { filtered, showAll, setShowAll, tenant, isSuperAdmin };
}

export function CuarentenaFilterBar({
  total,
  filtered,
  showAll,
  setShowAll,
  tenantLabel,
  isSuperAdmin,
}: {
  total: number;
  filtered: number;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  tenantLabel: string;
  isSuperAdmin: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500">
      <span>
        {filtered} de {total} contacto{total !== 1 ? "s" : ""} en cuarentena
        {!showAll && <span className="ml-1 text-zinc-600">· {tenantLabel}</span>}
      </span>
      {isSuperAdmin && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            showAll
              ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
              : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
          }`}
          title={showAll ? "Mostrando todo el Holding" : `Filtrado por ${tenantLabel}`}
        >
          <Eye className="h-3 w-3" />
          {showAll ? "Holding" : tenantLabel}
        </button>
      )}
    </div>
  );
}
