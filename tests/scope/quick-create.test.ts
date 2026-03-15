// ============================================================================
// tests/scope/quick-create.test.ts — TDD: Alta Rápida de Contactos
//
// @role:   @QA-Engineer / @Data-Architect
// @spec:   Fase 9.03 — Alta Rápida con SIN_REGISTRO + detección por nombre
//
// COBERTURA:
//   1. Alta Rápida usa SIN_REGISTRO → fiscal_id = null
//   2. Detección de duplicados por nombre normalizado
//   3. isFiscalPending() detecta contactos sin datos fiscales
//   4. Búsqueda por nombre es case-insensitive y normalizada
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Lógica pura: detección de pendiente fiscal ─────────────────────────────

/** Determina si un contacto tiene datos fiscales pendientes. */
function isFiscalPending(fiscalIdTipo: string | null, fiscalId: string | null): boolean {
  if (!fiscalIdTipo || fiscalIdTipo === "SIN_REGISTRO") return true;
  if (!fiscalId || !fiscalId.trim()) return true;
  return false;
}

// ─── Lógica pura: normalización de nombre para búsqueda ─────────────────────

/** Normaliza un nombre para comparación: mayúsculas, sin espacios extra. */
function normalizeName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Detecta coincidencia exacta normalizada entre dos nombres. */
function isNameMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("isFiscalPending — Detección de datos fiscales incompletos", () => {
  it("SIN_REGISTRO → pendiente", () => {
    expect(isFiscalPending("SIN_REGISTRO", null)).toBe(true);
  });

  it("SIN_REGISTRO con fiscal_id vacío → pendiente", () => {
    expect(isFiscalPending("SIN_REGISTRO", "")).toBe(true);
  });

  it("NIF con valor → NO pendiente", () => {
    expect(isFiscalPending("NIF", "12345678A")).toBe(false);
  });

  it("CIF con valor → NO pendiente", () => {
    expect(isFiscalPending("CIF", "B12345678")).toBe(false);
  });

  it("fiscal_id_tipo null → pendiente", () => {
    expect(isFiscalPending(null, null)).toBe(true);
  });

  it("fiscal_id_tipo presente pero fiscal_id vacío → pendiente", () => {
    expect(isFiscalPending("NIF", "")).toBe(true);
    expect(isFiscalPending("NIF", "   ")).toBe(true);
  });
});

describe("Detección de duplicados por nombre normalizado", () => {
  it("coincidencia exacta case-insensitive", () => {
    expect(isNameMatch("David Najar", "DAVID NAJAR")).toBe(true);
  });

  it("coincidencia con espacios extra", () => {
    expect(isNameMatch("David  Najar", "David Najar")).toBe(true);
  });

  it("no coincide con nombres diferentes", () => {
    expect(isNameMatch("David Najar", "Nieve Najar")).toBe(false);
  });

  it("coincidencia de razón social normalizada", () => {
    expect(isNameMatch("LEXCONOMY SL", "Lexconomy SL")).toBe(true);
  });

  it("no coincide parcialmente", () => {
    expect(isNameMatch("LEXCONOMY", "LEXCONOMY SL")).toBe(false);
  });

  it("cadenas vacías no coinciden con nada útil", () => {
    expect(isNameMatch("", "")).toBe(true); // ambas vacías → match (edge case)
    expect(isNameMatch("David", "")).toBe(false);
  });
});

describe("Alta Rápida — Contrato de datos mínimos", () => {
  /** Simula la validación mínima del Alta Rápida. */
  function validateQuickCreate(input: {
    tipo: string;
    nombre?: string;
    razon_social?: string;
  }): { valid: boolean; error?: string } {
    if (input.tipo === "PERSONA_FISICA" && !input.nombre?.trim()) {
      return { valid: false, error: "El nombre es obligatorio." };
    }
    if (input.tipo === "PERSONA_JURIDICA" && !input.razon_social?.trim()) {
      return { valid: false, error: "La razón social es obligatoria." };
    }
    return { valid: true };
  }

  it("PF válida con solo nombre", () => {
    expect(validateQuickCreate({ tipo: "PERSONA_FISICA", nombre: "David" }).valid).toBe(true);
  });

  it("PJ válida con solo razón social", () => {
    expect(validateQuickCreate({ tipo: "PERSONA_JURIDICA", razon_social: "Lexconomy SL" }).valid).toBe(true);
  });

  it("PF sin nombre → error", () => {
    expect(validateQuickCreate({ tipo: "PERSONA_FISICA" }).valid).toBe(false);
  });

  it("PJ sin razón social → error", () => {
    expect(validateQuickCreate({ tipo: "PERSONA_JURIDICA" }).valid).toBe(false);
  });
});
