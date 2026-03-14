"use client";

// ============================================================================
// CrossTenantBadge — Indica presencia del contacto en otra matriz
//
// @role: @Frontend-UX
// @spec: Fase 8.25 — Si el contacto tiene vínculos con la otra empresa,
//        muestra un badge discreto "También en LW" / "También en LX".
// ============================================================================

import { useTenant, TENANTS, type TenantId } from "@/lib/context/TenantContext";

interface CrossTenantBadgeProps {
  /** Lista de company_ids en los que el contacto tiene un ContactoCompanyLink. */
  linkedCompanyIds: string[];
}

export function CrossTenantBadge({ linkedCompanyIds }: CrossTenantBadgeProps) {
  const { tenant } = useTenant();

  // Filtrar: mostrar solo los tenants distintos al activo
  const otherTenants = linkedCompanyIds
    .filter((id): id is TenantId => id !== tenant.id && id in TENANTS)
    .map((id) => TENANTS[id]);

  if (otherTenants.length === 0) return null;

  return (
    <>
      {otherTenants.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset"
          style={{
            color: t.color,
            backgroundColor: `${t.color}15`,
            borderColor: `${t.color}30`,
          }}
          title={`Este contacto también está vinculado a ${t.nombre}`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: t.color }}
          />
          También en {t.shortLabel}
        </span>
      ))}
    </>
  );
}
