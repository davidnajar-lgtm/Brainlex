// ============================================================================
// tests/scope/link-roles.test.ts — TDD: Roles per-tenant en ContactoCompanyLink
//
// @role: @QA-Engineer / @Data-Architect
// @spec: Fase 8.27 — Los roles comerciales (Cliente, Proveedor, Matriz) se
//        determinan por ContactoCompanyLink.role, no por flags globales.
//
// Casos:
//   1. LINK_ROLES contiene los roles válidos del sistema
//   2. validateLinkRole acepta roles válidos
//   3. validateLinkRole rechaza roles inválidos
//   4. Anti-autofacturación: Matriz no puede ser Cliente en el MISMO tenant
//   5. Cross-tenant: Matriz en LW PUEDE ser Cliente en LX
//   6. resolveDisplayRole prioriza link.role sobre flags globales
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  LINK_ROLES,
  validateLinkRole,
  canAssignRole,
  resolveDisplayRole,
  type LinkRole,
} from "@/lib/modules/entidades/services/linkRole.service";

// ─── LINK_ROLES ──────────────────────────────────────────────────────────────

describe("LINK_ROLES", () => {
  it("contiene los roles esenciales del holding", () => {
    expect(LINK_ROLES).toContain("Cliente");
    expect(LINK_ROLES).toContain("Proveedor");
    expect(LINK_ROLES).toContain("Matriz");
    expect(LINK_ROLES).toContain("Contrario");
    expect(LINK_ROLES).toContain("Notario");
  });
});

// ─── validateLinkRole ────────────────────────────────────────────────────────

describe("validateLinkRole", () => {
  it("acepta roles válidos", () => {
    expect(validateLinkRole("Cliente")).toBe(true);
    expect(validateLinkRole("Proveedor")).toBe(true);
    expect(validateLinkRole("Matriz")).toBe(true);
  });

  it("rechaza roles inventados", () => {
    expect(validateLinkRole("SuperHero")).toBe(false);
    expect(validateLinkRole("")).toBe(false);
  });

  it("rechaza null/undefined", () => {
    expect(validateLinkRole(null as unknown as string)).toBe(false);
    expect(validateLinkRole(undefined as unknown as string)).toBe(false);
  });
});

// ─── canAssignRole (anti-autofacturación) ────────────────────────────────────

describe("canAssignRole — anti-autofacturación", () => {
  it("Matriz NO puede ser Cliente en el MISMO tenant", () => {
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

  it("Cliente puede vincularse si no hay conflicto", () => {
    const result = canAssignRole({
      role: "Cliente",
      targetCompanyId: "LX",
      existingLinks: [],
    });
    expect(result.allowed).toBe(true);
  });

  it("Matriz NO puede ser Matriz dos veces en distintos tenants", () => {
    const result = canAssignRole({
      role: "Matriz",
      targetCompanyId: "LW",
      existingLinks: [{ company_id: "LX", role: "Matriz" }],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/una sola sociedad/i);
  });

  it("Proveedor se permite sin restricciones", () => {
    const result = canAssignRole({
      role: "Proveedor",
      targetCompanyId: "LX",
      existingLinks: [{ company_id: "LX", role: "Matriz" }],
    });
    expect(result.allowed).toBe(true);
  });
});

// ─── resolveDisplayRole ──────────────────────────────────────────────────────

describe("resolveDisplayRole", () => {
  it("usa link.role cuando existe", () => {
    expect(resolveDisplayRole({
      linkRole: "Cliente",
      esCliente: false,
      esPrecliente: false,
      esFacturadora: true,
    })).toBe("Cliente");
  });

  it("fallback a flags globales si link.role es null", () => {
    expect(resolveDisplayRole({
      linkRole: null,
      esCliente: true,
      esPrecliente: false,
      esFacturadora: false,
    })).toBe("Cliente");
  });

  it("fallback a Matriz si es_facturadora y sin link.role", () => {
    expect(resolveDisplayRole({
      linkRole: null,
      esCliente: false,
      esPrecliente: false,
      esFacturadora: true,
    })).toBe("Matriz");
  });

  it("fallback a Pre-cliente si es_precliente y sin link.role", () => {
    expect(resolveDisplayRole({
      linkRole: null,
      esCliente: false,
      esPrecliente: true,
      esFacturadora: false,
    })).toBe("Pre-cliente");
  });

  it("fallback a Contacto si ningún flag y sin link.role", () => {
    expect(resolveDisplayRole({
      linkRole: null,
      esCliente: false,
      esPrecliente: false,
      esFacturadora: false,
    })).toBe("Contacto");
  });
});
