"use client";

// ============================================================================
// app/contactos/_modules/ficha/RolesPanel.tsx
//
// @role: @Frontend-UX + @UX-Strategist
// @spec: Fase 10.08 — Roles per-tenant via ContactoCompanyLink.role
//
// El rol de un contacto es ESTRICTAMENTE per-tenant:
//   - Se lee de ContactoCompanyLink.role para el tenant activo
//   - Se escribe via updateLinkRole (no en flags globales)
//   - Toggle: clic en rol activo → desactivar (Contacto base)
// ============================================================================

import { useState, useEffect, useTransition } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { useTenant } from "@/lib/context/TenantContext";
import { updateLinkRole } from "@/lib/modules/entidades/actions/contactos.actions";
import type { LinkRole } from "@/lib/modules/entidades/services/linkRole.service";

interface CompanyLink {
  company_id: string;
  role: string | null;
}

export function RolesPanel({
  contactoId,
  initialEsCliente,
  initialEsPrecliente,
  initialEsFacturadora,
  companyLinks = [],
}: {
  contactoId:           string;
  initialEsCliente:     boolean;
  initialEsPrecliente:  boolean;
  initialEsFacturadora: boolean;
  companyLinks?:        CompanyLink[];
}) {
  const { tenant } = useTenant();
  const [editing,   setEditing]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fuente de verdad: link.role del tenant activo
  const currentLink = companyLinks.find((l) => l.company_id === tenant.id);
  const initialLinkRole = currentLink?.role ?? null;

  // Estado local para optimistic update
  const [linkRole, setLinkRole] = useState<string | null>(initialLinkRole);

  // Sincronizar cuando cambia el tenant activo
  useEffect(() => {
    const link = companyLinks.find((l) => l.company_id === tenant.id);
    setLinkRole(link?.role ?? null);
    setEditing(false);
    setError(null);
  }, [tenant.id, companyLinks]);

  // Resolver el displayRole desde el link.role (fuente primaria)
  // con fallback a flags globales (retrocompatibilidad legacy)
  const displayRole = linkRole
    ?? (initialEsFacturadora ? "Matriz" : null)
    ?? (initialEsCliente ? "Cliente" : null)
    ?? (initialEsPrecliente ? "Pre-cliente" : null)
    ?? "Contacto";

  function handleToggleRole(requestedRole: LinkRole) {
    setError(null);
    // Optimistic update
    const optimisticNew = linkRole === requestedRole ? null : requestedRole;
    const previousRole = linkRole;
    setLinkRole(optimisticNew);

    startTransition(async () => {
      const result = await updateLinkRole(contactoId, tenant.id, requestedRole);
      if (!result.ok) {
        // Revert optimistic update
        setLinkRole(previousRole);
        setError(result.error);
      } else {
        setLinkRole(result.newRole);
      }
    });
  }

  const ROLE_CONFIG: {
    role: LinkRole;
    label: string;
    icon: "shield" | "dot";
    activeClasses: string;
    dotClasses: string;
  }[] = [
    {
      role: "Matriz",
      label: "Matriz",
      icon: "shield",
      activeClasses: "border-[var(--badge-matriz-ring)] bg-[var(--badge-matriz-bg)] text-[var(--badge-matriz-text)] hover:opacity-75",
      dotClasses: "text-[var(--badge-matriz-text)]",
    },
    {
      role: "Cliente",
      label: "Cliente",
      icon: "dot",
      activeClasses: "border-[var(--badge-cliente-ring)] bg-[var(--badge-cliente-bg)] text-[var(--badge-cliente-text)] hover:opacity-75",
      dotClasses: "bg-[var(--badge-cliente-text)]",
    },
    {
      role: "Pre-cliente",
      label: "Pre-cliente",
      icon: "dot",
      activeClasses: "border-[var(--badge-prec-ring)] bg-[var(--badge-prec-bg)] text-[var(--badge-prec-text)] hover:opacity-75",
      dotClasses: "bg-[var(--badge-prec-text)]",
    },
  ];

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* ── Per-tenant role badge ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1">
        {displayRole === "Matriz" && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-[var(--badge-matriz-bg)] text-[var(--badge-matriz-text)] ring-[var(--badge-matriz-ring)]">
            MATRIZ
          </span>
        )}
        {displayRole === "Cliente" && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-[var(--badge-cliente-bg)] text-[var(--badge-cliente-text)] ring-[var(--badge-cliente-ring)]">
            CLIENTE
          </span>
        )}
        {displayRole === "Pre-cliente" && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-[var(--badge-prec-bg)] text-[var(--badge-prec-text)] ring-[var(--badge-prec-ring)]">
            PRE-CLIENTE
          </span>
        )}
        {displayRole === "Contacto" && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-zinc-700/60 text-zinc-300 ring-zinc-500/50">
            CONTACTO
          </span>
        )}
        <span className="text-[9px] text-zinc-600">
          en {tenant.shortLabel}
        </span>
      </div>

      {/* ── Toggle link ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
      >
        {editing ? (
          <>
            Cerrar selector
            <ChevronUp className="h-2.5 w-2.5" />
          </>
        ) : (
          <>
            Cambiar rol en {tenant.shortLabel}
            <ChevronDown className="h-2.5 w-2.5" />
          </>
        )}
      </button>

      {/* ── Role selector (per-tenant) ────────────────────────────────── */}
      {editing && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {ROLE_CONFIG.map(({ role, label, icon, activeClasses, dotClasses }) => {
            const isActive = linkRole === role;
            return (
              <button
                key={role}
                onClick={() => handleToggleRole(role)}
                disabled={isPending}
                title={isActive ? `Quitar rol ${label}` : `Asignar como ${label}`}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  "border transition-colors duration-150 disabled:opacity-50",
                  isActive
                    ? activeClasses
                    : "border-zinc-600 bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
                ].join(" ")}
              >
                {icon === "shield" ? (
                  <Shield className={`h-3 w-3 ${isActive ? dotClasses : "text-zinc-600"}`} />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? dotClasses : "bg-zinc-600"}`} />
                )}
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Error inline */}
      {error && (
        <p className="text-[11px] text-amber-400">{error}</p>
      )}
    </div>
  );
}
