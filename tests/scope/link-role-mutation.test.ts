// ============================================================================
// tests/scope/link-role-mutation.test.ts — TDD: updateLinkRole per-tenant
//
// @role: @QA-Engineer / @Data-Architect
// @spec: Fase 10.08 — Los roles se escriben en ContactoCompanyLink.role,
//        no en flags globales del Contacto.
//
// Casos:
//   1. updateLinkRole escribe en ContactoCompanyLink.role para el tenant activo
//   2. Cambiar de null → "Cliente" produce role="Cliente" en el link
//   3. Cambiar de "Cliente" → null (Contacto base) limpia el role
//   4. Anti-autofacturación: Matriz en LX no puede ser Cliente en LX
//   5. Unicidad de Matriz: solo una sociedad por contacto
//   6. Cross-tenant: Matriz en LW sí puede ser Cliente en LX
//   7. Toggle: mismo rol → se desactiva (vuelve a null)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  canAssignRole,
  validateLinkRole,
  LINK_ROLES,
  type LinkRole,
} from "@/lib/modules/entidades/services/linkRole.service";

// ─── Lógica de resolución de nuevo rol (toggle semántico) ───────────────────

/**
 * Replica la lógica de toggle que usará updateLinkRole:
 * - Si el rol solicitado es el mismo que el actual → null (desactivar)
 * - Si es diferente → activar el nuevo
 */
function resolveToggle(
  currentRole: string | null,
  requestedRole: LinkRole,
): string | null {
  return currentRole === requestedRole ? null : requestedRole;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Link Role Toggle Logic", () => {
  it("activa un rol cuando el actual es null", () => {
    expect(resolveToggle(null, "Cliente")).toBe("Cliente");
  });

  it("desactiva el rol cuando se solicita el mismo (toggle off)", () => {
    expect(resolveToggle("Cliente", "Cliente")).toBe(null);
  });

  it("cambia de un rol a otro", () => {
    expect(resolveToggle("Pre-cliente", "Cliente")).toBe("Cliente");
  });

  it("desactiva Matriz cuando ya es Matriz", () => {
    expect(resolveToggle("Matriz", "Matriz")).toBe(null);
  });
});

describe("canAssignRole — validación pre-mutación", () => {
  it("Matriz en LX NO puede ser Cliente en LX (anti-autofacturación)", () => {
    const result = canAssignRole({
      role: "Cliente",
      targetCompanyId: "LX",
      existingLinks: [{ company_id: "LX", role: "Matriz" }],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/autofacturación/i);
  });

  it("Matriz en LW SÍ puede ser Cliente en LX (cross-tenant)", () => {
    const result = canAssignRole({
      role: "Cliente",
      targetCompanyId: "LX",
      existingLinks: [{ company_id: "LW", role: "Matriz" }],
    });
    expect(result.allowed).toBe(true);
  });

  it("NO puede ser Matriz en dos tenants distintos", () => {
    const result = canAssignRole({
      role: "Matriz",
      targetCompanyId: "LW",
      existingLinks: [{ company_id: "LX", role: "Matriz" }],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/una sola sociedad/i);
  });

  it("Contacto base puede ser Cliente sin conflicto", () => {
    const result = canAssignRole({
      role: "Cliente",
      targetCompanyId: "LX",
      existingLinks: [{ company_id: "LX", role: null }],
    });
    expect(result.allowed).toBe(true);
  });

  it("Pre-cliente en LX puede pasar a Cliente en LX", () => {
    const result = canAssignRole({
      role: "Cliente",
      targetCompanyId: "LX",
      existingLinks: [{ company_id: "LX", role: "Pre-cliente" }],
    });
    expect(result.allowed).toBe(true);
  });
});

describe("validateLinkRole — solo roles válidos del sistema", () => {
  it("acepta todos los LINK_ROLES", () => {
    for (const role of LINK_ROLES) {
      expect(validateLinkRole(role)).toBe(true);
    }
  });

  it("rechaza roles funcionales (SALI)", () => {
    expect(validateLinkRole("Proveedor")).toBe(false);
    expect(validateLinkRole("Contrario")).toBe(false);
  });
});
