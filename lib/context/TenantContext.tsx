"use client";

// ============================================================================
// lib/context/TenantContext.tsx — @Scope-Guard: Contexto Global de Tenant
//
// Gestiona el tenant activo (LX / LW) y expone el scope para filtrado
// de etiquetas y queries de Prisma.
//
// REGLAS:
//   · Persiste en localStorage para sobrevivir recargas de página
//   · isSuperAdmin=true (CEO): ve todos los scopes; operativamente filtra
//     por el tenant activo, pero informes y taxonomía muestran todo
//   · El cambio de tenant limpia el TagSelector automáticamente (ver useTenant)
// ============================================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { EtiquetaScope } from "@prisma/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TenantId = "LX" | "LW";

export interface TenantInfo {
  id:          TenantId;
  nombre:      string;
  scope:       EtiquetaScope;
  color:       string;   /// Color del badge en Sidebar
  shortLabel:  string;   /// "LX" | "LW"
}

export const TENANTS: Record<TenantId, TenantInfo> = {
  LX: {
    id:         "LX",
    nombre:     "Lexconomy SL",
    scope:      "LEXCONOMY",
    color:      "#FF8C00", // naranja corporativo
    shortLabel: "LX",
  },
  LW: {
    id:         "LW",
    nombre:     "Lawtech SL",
    scope:      "LAWTECH",
    color:      "#9B1B30", // granate corporativo
    shortLabel: "LW",
  },
};

export interface TenantContextValue {
  tenant:       TenantInfo;
  isSuperAdmin: boolean;
  setTenant:    (id: TenantId) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TenantContext = createContext<TenantContextValue | null>(null);

const STORAGE_KEY = "brainlex_active_tenant";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState<TenantId>("LX");

  // Hidratar desde localStorage (solo client-side)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as TenantId | null;
      if (stored && stored in TENANTS) setTenantId(stored);
    } catch {}
  }, []);

  const setTenant = useCallback((id: TenantId) => {
    setTenantId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const value: TenantContextValue = {
    tenant:       TENANTS[tenantId],
    isSuperAdmin: true, // CEO siempre. Conectar con Supabase Auth en Fase 5
    setTenant,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant debe usarse dentro de <TenantProvider>");
  return ctx;
}
