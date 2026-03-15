// ============================================================================
// tests/scope/link-roles.test.ts — TDD: Roles per-tenant en ContactoCompanyLink
//
// @role: @QA-Engineer / @Data-Architect
// @spec: Fase 8.27 — Los roles comerciales se determinan por
//        ContactoCompanyLink.role, no por flags globales.
//
// Roles actuales: Cliente, Pre-cliente, Contacto, Matriz.
// Roles funcionales (Proveedor, Contrario, Notario) se gestionarán
// vía sistema de etiquetas SALI, no como link.role hardcodeados.
//
// Casos:
//   1. LINK_ROLES contiene los roles válidos del sistema
//   2. validateLinkRole acepta roles válidos
//   3. validateLinkRole rechaza roles inválidos / futuros roles SALI
//   4. Anti-autofacturación: Matriz no puede ser Cliente en el MISMO tenant
//   5. Cross-tenant: Matriz en LW PUEDE ser Cliente en LX
//   6. resolveDisplayRole prioriza link.role sobre flags globales
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  LINK_ROLES,
  IMPORT_ROLES,
  validateLinkRole,
  canAssignRole,
  resolveDisplayRole,
  type LinkRole,
} from "@/lib/modules/entidades/services/linkRole.service";

// ─── LINK_ROLES ──────────────────────────────────────────────────────────────

describe("LINK_ROLES", () => {
  it("contiene los roles base del holding", () => {
    expect(LINK_ROLES).toContain("Cliente");
    expect(LINK_ROLES).toContain("Pre-cliente");
    expect(LINK_ROLES).toContain("Contacto");
    expect(LINK_ROLES).toContain("Matriz");
  });

  it("NO contiene roles funcionales (se gestionan vía SALI)", () => {
    expect(LINK_ROLES).not.toContain("Proveedor");
    expect(LINK_ROLES).not.toContain("Contrario");
    expect(LINK_ROLES).not.toContain("Notario");
  });
});

// ─── IMPORT_ROLES ────────────────────────────────────────────────────────────

describe("IMPORT_ROLES", () => {
  it("ofrece solo roles seleccionables al importar", () => {
    expect(IMPORT_ROLES).toEqual(["Cliente", "Pre-cliente"]);
  });

  it("excluye Matriz (se asigna automáticamente)", () => {
    expect(IMPORT_ROLES).not.toContain("Matriz");
  });
});

// ─── validateLinkRole ────────────────────────────────────────────────────────

describe("validateLinkRole", () => {
  it("acepta roles válidos", () => {
    expect(validateLinkRole("Cliente")).toBe(true);
    expect(validateLinkRole("Contacto")).toBe(true);
    expect(validateLinkRole("Matriz")).toBe(true);
  });

  it("rechaza roles funcionales (futuros — vía SALI)", () => {
    expect(validateLinkRole("Proveedor")).toBe(false);
    expect(validateLinkRole("Contrario")).toBe(false);
    expect(validateLinkRole("Notario")).toBe(false);
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

  it("Contacto se permite junto a Matriz (no es autofacturación)", () => {
    const result = canAssignRole({
      role: "Contacto" as LinkRole,
      targetCompanyId: "LX",
      existingLinks: [{ company_id: "LW", role: "Matriz" }],
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
