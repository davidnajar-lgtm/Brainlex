"use client";

// ============================================================================
// TenantScopeGuard — Redirige al listado si el contacto no pertenece al tenant
//
// @role: @UX-Strategist + @Security-CISO
// @spec: Guard client-side que detecta cambio de empresa maestra y redirige
//        cuando el contacto no está vinculado al tenant activo.
//
// Uso: renderizar en la page del contacto con los linkedCompanyIds del RSC.
// ============================================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/lib/context/TenantContext";

interface TenantScopeGuardProps {
  linkedCompanyIds: string[];
}

export function TenantScopeGuard({ linkedCompanyIds }: TenantScopeGuardProps) {
  const { tenant } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!linkedCompanyIds.includes(tenant.id)) {
      router.replace("/contactos");
    }
  }, [tenant.id, linkedCompanyIds, router]);

  return null;
}
