// ============================================================================
// tests/scope/multitenant-boveda.test.ts
//
// @role:   @QA-Engineer / @Security-CISO
// @spec:   Protección Multitenant en Bóveda — Carpetas y Archivos
//
// COBERTURA:
//   1. Carpeta con company_id de otro tenant → borrado/movimiento BLOQUEADO
//   2. Carpeta del propio tenant → borrado/movimiento PERMITIDO
//   3. Carpeta con company_id=null → accesible por cualquier tenant
//   4. Sin companyId (SuperAdmin) → acceso total
//
// NOTA: Tests de lógica pura sin BD. Validan el contrato de decisión.
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Simulación del contrato de decisión tenant-guard ───────────────────────

/**
 * Reproduce la lógica del guard de deleteCarpeta/moveCarpeta:
 *   - Si la carpeta tiene company_id Y el caller tiene companyId
 *     → solo permite si coinciden
 *   - Si la carpeta tiene company_id=null → permite (carpeta preexistente)
 *   - Si no se pasa companyId → permite (SuperAdmin bypass)
 */
function canOperateCarpeta(
  carpetaCompanyId: string | null,
  callerCompanyId?: string | null,
): { allowed: boolean; reason?: string } {
  if (callerCompanyId && carpetaCompanyId && carpetaCompanyId !== callerCompanyId) {
    return {
      allowed: false,
      reason: `Esta carpeta pertenece a ${carpetaCompanyId}. No se puede operar desde ${callerCompanyId}.`,
    };
  }
  return { allowed: true };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Multitenant Bóveda — Protección de Carpetas Cross-Tenant", () => {
  it("LW no puede borrar carpeta de LX", () => {
    const result = canOperateCarpeta("LX", "LW");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("LX");
  });

  it("LX no puede borrar carpeta de LW", () => {
    const result = canOperateCarpeta("LW", "LX");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("LW");
  });

  it("LX puede borrar su propia carpeta", () => {
    const result = canOperateCarpeta("LX", "LX");
    expect(result.allowed).toBe(true);
  });

  it("LW puede borrar su propia carpeta", () => {
    const result = canOperateCarpeta("LW", "LW");
    expect(result.allowed).toBe(true);
  });

  it("carpeta sin company_id (preexistente) → accesible por cualquier tenant", () => {
    expect(canOperateCarpeta(null, "LX").allowed).toBe(true);
    expect(canOperateCarpeta(null, "LW").allowed).toBe(true);
  });

  it("SuperAdmin (sin companyId) → acceso total", () => {
    expect(canOperateCarpeta("LX", null).allowed).toBe(true);
    expect(canOperateCarpeta("LW", null).allowed).toBe(true);
    expect(canOperateCarpeta("LX", undefined).allowed).toBe(true);
  });

  it("tenant hipotético LC no puede operar carpeta de LX", () => {
    const result = canOperateCarpeta("LX", "LC");
    expect(result.allowed).toBe(false);
  });
});
