"use client";

// ============================================================================
// app/_components/ContactosKpiCard.tsx — KPI Card de Contactos (Dashboard)
//
// Muestra contactos totales del grupo + desglose por tenant activo.
// Lee el tenant activo desde TenantContext (client-side).
// ============================================================================

import { useTenant } from "@/lib/context/TenantContext";

interface ContactosKpiCardProps {
  total: number;
  lx: number;
  lw: number;
}

export function ContactosKpiCard({ total, lx, lw }: ContactosKpiCardProps) {
  const { tenant } = useTenant();
  const tenantCount = tenant.id === "LX" ? lx : lw;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">Contactos activos</p>
        <span className="rounded-lg p-2 bg-sky-500/10 text-sky-400">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-zinc-100">{total}</p>
      <p className="mt-0.5 text-xs text-zinc-600">
        {tenantCount} en {tenant.shortLabel} · {total} en grupo
      </p>
    </div>
  );
}
