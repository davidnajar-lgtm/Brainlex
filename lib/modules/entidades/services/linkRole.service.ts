// ============================================================================
// lib/modules/entidades/services/linkRole.service.ts
//
// @role: @Data-Architect
// @spec: Fase 8.27 — Roles per-tenant en ContactoCompanyLink
//
// FUNCIÓN PURA: no toca BD. Valida y resuelve roles de vínculo.
//
// Regla anti-autofacturación:
//   Un contacto con role "Matriz" en un tenant NO puede tener role "Cliente"
//   en ESE MISMO tenant. Cross-tenant sí se permite.
//
// Regla de unicidad de Matriz:
//   Un contacto solo puede ser "Matriz" en una sola sociedad.
// ============================================================================

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Roles válidos para ContactoCompanyLink.role. */
export const LINK_ROLES = [
  "Cliente",
  "Pre-cliente",
  "Proveedor",
  "Contrario",
  "Notario",
  "Matriz",
] as const;

export type LinkRole = (typeof LINK_ROLES)[number];

// ─── Validación ──────────────────────────────────────────────────────────────

/** Verifica si un string es un LinkRole válido. */
export function validateLinkRole(role: string | null | undefined): role is LinkRole {
  if (!role) return false;
  return (LINK_ROLES as readonly string[]).includes(role);
}

// ─── Anti-autofacturación ────────────────────────────────────────────────────

interface ExistingLink {
  company_id: string;
  role: string | null;
}

interface CanAssignInput {
  role: LinkRole;
  targetCompanyId: string;
  existingLinks: ExistingLink[];
}

interface CanAssignResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Valida si se puede asignar un rol a un contacto en un tenant.
 *
 * Reglas:
 *   1. No se puede ser Cliente y Matriz en el MISMO tenant (anti-autofacturación)
 *   2. Un contacto solo puede ser Matriz en una sola sociedad
 */
export function canAssignRole(input: CanAssignInput): CanAssignResult {
  const { role, targetCompanyId, existingLinks } = input;

  // Regla 1: Anti-autofacturación — Matriz + Cliente en mismo tenant
  if (role === "Cliente" || role === "Pre-cliente") {
    const isMatrizInTarget = existingLinks.some(
      (l) => l.company_id === targetCompanyId && l.role === "Matriz"
    );
    if (isMatrizInTarget) {
      return {
        allowed: false,
        reason: "Anti-autofacturación: la entidad es Matriz en este mismo tenant. No puede ser Cliente de sí misma.",
      };
    }
  }

  // Regla 1b: No puedo ser Matriz si ya soy Cliente en el mismo tenant
  if (role === "Matriz") {
    const isClienteInTarget = existingLinks.some(
      (l) => l.company_id === targetCompanyId && (l.role === "Cliente" || l.role === "Pre-cliente")
    );
    if (isClienteInTarget) {
      return {
        allowed: false,
        reason: "Anti-autofacturación: la entidad ya es Cliente en este tenant. No puede ser también Matriz.",
      };
    }
  }

  // Regla 2: Unicidad de Matriz — solo una sociedad por contacto
  if (role === "Matriz") {
    const existingMatriz = existingLinks.find((l) => l.role === "Matriz");
    if (existingMatriz) {
      return {
        allowed: false,
        reason: "Una entidad solo puede ser Matriz de una sola sociedad del holding.",
      };
    }
  }

  return { allowed: true };
}

// ─── Display role resolution ─────────────────────────────────────────────────

interface DisplayRoleInput {
  linkRole: string | null;
  esCliente: boolean;
  esPrecliente: boolean;
  esFacturadora: boolean;
}

/**
 * Resuelve el rol a mostrar en UI.
 * Prioridad: link.role > flags globales > "Contacto" (fallback).
 */
export function resolveDisplayRole(input: DisplayRoleInput): string {
  // 1. Link role tiene prioridad absoluta (per-tenant truth)
  if (input.linkRole && validateLinkRole(input.linkRole)) {
    return input.linkRole;
  }

  // 2. Fallback a flags globales (legacy / compatibilidad)
  if (input.esFacturadora) return "Matriz";
  if (input.esCliente) return "Cliente";
  if (input.esPrecliente) return "Pre-cliente";

  return "Contacto";
}
