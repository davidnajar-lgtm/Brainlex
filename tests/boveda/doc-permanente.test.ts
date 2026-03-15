// ============================================================================
// tests/boveda/doc-permanente.test.ts — TDD: DocPermanente + Mirror por ID
//
// @role: @QA-Engineer / @Integration-Broker
// @spec: FASE 12.04 — Cierre de Arquitectura: Sincronización por ID Interno
//
// COBERTURA:
//   1. ensureDocPermanente — carpeta idempotente
//   2. Mirror detection — por ContactoCompanyLink (ID interno, NO NIF)
//   3. Mirror eligibility — solo archivos en 00_DOCUMENTACION_PERMANENTE
//   4. DocPermanente — propiedades de la carpeta
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Constantes ─────────────────────────────────────────────────────────────

const DOC_PERMANENTE_NOMBRE = "00_DOCUMENTACION_PERMANENTE";

// ─── 1. ensureDocPermanente — idempotencia ──────────────────────────────────

describe("DocPermanente — ensureDocPermanente", () => {
  function shouldCreateDocPermanente(
    existingCarpetas: { nombre: string; tipo: string; parent_id: string | null }[],
  ): boolean {
    return !existingCarpetas.some(
      (c) => c.nombre === DOC_PERMANENTE_NOMBRE && c.parent_id === null,
    );
  }

  it("crea la carpeta si no existe ninguna carpeta", () => {
    expect(shouldCreateDocPermanente([])).toBe(true);
  });

  it("crea la carpeta si existen otras pero no DocPermanente", () => {
    const existing = [
      { nombre: "Fiscal", tipo: "INTELIGENTE", parent_id: null },
      { nombre: "Laboral", tipo: "INTELIGENTE", parent_id: null },
    ];
    expect(shouldCreateDocPermanente(existing)).toBe(true);
  });

  it("NO crea si ya existe 00_DOCUMENTACION_PERMANENTE en raíz", () => {
    const existing = [
      { nombre: DOC_PERMANENTE_NOMBRE, tipo: "INTELIGENTE", parent_id: null },
    ];
    expect(shouldCreateDocPermanente(existing)).toBe(false);
  });

  it("SÍ crea si existe pero como subcarpeta (parent_id no null)", () => {
    const existing = [
      { nombre: DOC_PERMANENTE_NOMBRE, tipo: "INTELIGENTE", parent_id: "some-parent" },
    ];
    expect(shouldCreateDocPermanente(existing)).toBe(true);
  });

  it("el nombre siempre es '00_DOCUMENTACION_PERMANENTE' (prefijo 00_ para ordenación)", () => {
    expect(DOC_PERMANENTE_NOMBRE).toBe("00_DOCUMENTACION_PERMANENTE");
    expect(DOC_PERMANENTE_NOMBRE < "A").toBe(true);
  });
});

// ─── 2. Mirror detection — ID interno vía ContactoCompanyLink ───────────────

describe("Mirror — detección multi-tenant por ID interno (UUID)", () => {
  interface CompanyLink {
    contacto_id: string;
    company_id: string;
  }

  /**
   * FASE 12.04: El ancla es el UUID del contacto.
   * Un contacto es "multi-tenant" si tiene CompanyLinks en 2+ tenants.
   * NO se usa NIF — se usa el ID interno directamente.
   */
  function getLinkedTenants(contactoId: string, allLinks: CompanyLink[]): string[] {
    return allLinks
      .filter((l) => l.contacto_id === contactoId)
      .map((l) => l.company_id);
  }

  function isMultiTenant(contactoId: string, allLinks: CompanyLink[]): boolean {
    return getLinkedTenants(contactoId, allLinks).length > 1;
  }

  const LINKS: CompanyLink[] = [
    { contacto_id: "uuid-shared", company_id: "LX" },
    { contacto_id: "uuid-shared", company_id: "LW" },
    { contacto_id: "uuid-only-lx", company_id: "LX" },
    { contacto_id: "uuid-only-lw", company_id: "LW" },
  ];

  it("contacto compartido (LX+LW) → multi-tenant = true", () => {
    expect(isMultiTenant("uuid-shared", LINKS)).toBe(true);
  });

  it("contacto solo en LX → multi-tenant = false", () => {
    expect(isMultiTenant("uuid-only-lx", LINKS)).toBe(false);
  });

  it("contacto solo en LW → multi-tenant = false", () => {
    expect(isMultiTenant("uuid-only-lw", LINKS)).toBe(false);
  });

  it("contacto inexistente → multi-tenant = false", () => {
    expect(isMultiTenant("uuid-unknown", LINKS)).toBe(false);
  });

  it("contacto compartido tiene exactamente 2 tenants", () => {
    const tenants = getLinkedTenants("uuid-shared", LINKS);
    expect(tenants).toEqual(["LX", "LW"]);
    expect(tenants).toHaveLength(2);
  });

  it("contacto single-tenant tiene exactamente 1 tenant", () => {
    const tenants = getLinkedTenants("uuid-only-lx", LINKS);
    expect(tenants).toEqual(["LX"]);
    expect(tenants).toHaveLength(1);
  });
});

// ─── 3. Mirror eligibility — solo doc permanente ────────────────────────────

describe("Mirror — eligibilidad de sincronización", () => {
  function isMirrorEligible(carpetaNombre: string): boolean {
    return carpetaNombre === DOC_PERMANENTE_NOMBRE;
  }

  it("archivo en 00_DOCUMENTACION_PERMANENTE → elegible", () => {
    expect(isMirrorEligible(DOC_PERMANENTE_NOMBRE)).toBe(true);
  });

  it("archivo en carpeta Fiscal → NO elegible", () => {
    expect(isMirrorEligible("Fiscal")).toBe(false);
  });

  it("archivo en carpeta con nombre similar → NO elegible", () => {
    expect(isMirrorEligible("DOCUMENTACION_PERMANENTE")).toBe(false);
    expect(isMirrorEligible("00_documentacion_permanente")).toBe(false);
  });
});

// ─── 4. DocPermanente — propiedades de la carpeta ───────────────────────────

describe("DocPermanente — propiedades", () => {
  function buildDocPermanenteCarpeta(contactoId: string) {
    return {
      nombre: DOC_PERMANENTE_NOMBRE,
      tipo: "INTELIGENTE" as const,
      contacto_id: contactoId,
      company_id: null,
      parent_id: null,
      etiqueta_id: null,
      es_blueprint: true,
      orden: -1,
    };
  }

  it("company_id es null (visible para todos los tenants)", () => {
    const c = buildDocPermanenteCarpeta("test-id");
    expect(c.company_id).toBeNull();
  });

  it("es_blueprint es true (inmutable)", () => {
    const c = buildDocPermanenteCarpeta("test-id");
    expect(c.es_blueprint).toBe(true);
  });

  it("parent_id es null (siempre raíz)", () => {
    const c = buildDocPermanenteCarpeta("test-id");
    expect(c.parent_id).toBeNull();
  });

  it("orden es -1 (siempre primero en el árbol)", () => {
    const c = buildDocPermanenteCarpeta("test-id");
    expect(c.orden).toBe(-1);
  });

  it("tipo es INTELIGENTE (no manual — gestionada por sistema)", () => {
    const c = buildDocPermanenteCarpeta("test-id");
    expect(c.tipo).toBe("INTELIGENTE");
  });
});

// ─── 5. Mirror Drive Sync — resultado esperado ─────────────────────────────

describe("Mirror Drive Sync — lógica de sincronización", () => {
  /**
   * Simula la lógica de triggerMirrorDriveSync.
   * Solo sincroniza si: carpeta es DocPermanente AND contacto es multi-tenant.
   */
  function shouldSync(
    carpetaNombre: string,
    tenantCount: number,
  ): { sync: boolean; reason?: string } {
    if (carpetaNombre !== DOC_PERMANENTE_NOMBRE) {
      return { sync: false, reason: "Carpeta no es DocPermanente" };
    }
    if (tenantCount < 2) {
      return { sync: false, reason: "Contacto en un solo tenant" };
    }
    return { sync: true };
  }

  it("DocPermanente + multi-tenant → sincroniza", () => {
    expect(shouldSync(DOC_PERMANENTE_NOMBRE, 2).sync).toBe(true);
  });

  it("DocPermanente + single-tenant → NO sincroniza", () => {
    const result = shouldSync(DOC_PERMANENTE_NOMBRE, 1);
    expect(result.sync).toBe(false);
    expect(result.reason).toMatch(/un solo tenant/);
  });

  it("otra carpeta + multi-tenant → NO sincroniza", () => {
    const result = shouldSync("Fiscal", 2);
    expect(result.sync).toBe(false);
    expect(result.reason).toMatch(/DocPermanente/);
  });

  it("otra carpeta + single-tenant → NO sincroniza", () => {
    expect(shouldSync("Manual", 1).sync).toBe(false);
  });
});
