// ============================================================================
// tests/scope/multitenant-delete.test.ts
//
// @role:   @QA-Engineer / @Security-CISO
// @spec:   Protección Multitenant en Borrado — Desvinculación vs Purga
//
// COBERTURA:
//   1. Contacto en múltiples tenants → borrar desde uno = desvincular, no purgar
//   2. Contacto en un solo tenant → borrar = flujo completo (Agente Legal)
//   3. La desvinculación no afecta los links de otros tenants
//
// NOTA: Tests de lógica pura sin BD. Validan el contrato de decisión.
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Simulación del contrato de decisión multitenant ────────────────────────

/**
 * Reproduce la lógica de decisión de deleteContacto:
 *   - Si el contacto tiene >1 link Y se proporciona companyId → UNLINK
 *   - Si el contacto tiene 1 link (o no se proporciona companyId) → FULL_DELETE
 */
function resolveDeleteStrategy(
  links: { company_id: string; role: string | null }[],
  companyId?: string
): "UNLINK" | "FULL_DELETE" {
  if (companyId && links.length > 1) {
    return "UNLINK";
  }
  return "FULL_DELETE";
}

/** Simula la desvinculación: elimina el link del tenant indicado. */
function simulateUnlink(
  links: { company_id: string; role: string | null }[],
  companyId: string
): { company_id: string; role: string | null }[] {
  return links.filter((l) => l.company_id !== companyId);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Multitenant Delete — Protección de Contactos Compartidos", () => {
  const sharedLinks = [
    { company_id: "LX", role: "Cliente" },
    { company_id: "LW", role: "Cliente" },
  ];

  const singleLink = [
    { company_id: "LX", role: "Cliente" },
  ];

  it("contacto en LX+LW: borrar desde LX → UNLINK (no purga)", () => {
    const strategy = resolveDeleteStrategy(sharedLinks, "LX");
    expect(strategy).toBe("UNLINK");
  });

  it("contacto en LX+LW: borrar desde LW → UNLINK (no purga)", () => {
    const strategy = resolveDeleteStrategy(sharedLinks, "LW");
    expect(strategy).toBe("UNLINK");
  });

  it("contacto solo en LX: borrar desde LX → FULL_DELETE (Agente Legal)", () => {
    const strategy = resolveDeleteStrategy(singleLink, "LX");
    expect(strategy).toBe("FULL_DELETE");
  });

  it("sin companyId proporcionado → FULL_DELETE (comportamiento legacy)", () => {
    const strategy = resolveDeleteStrategy(sharedLinks, undefined);
    expect(strategy).toBe("FULL_DELETE");
  });

  it("desvinculación de LX preserva el link de LW intacto", () => {
    const remaining = simulateUnlink(sharedLinks, "LX");
    expect(remaining).toEqual([{ company_id: "LW", role: "Cliente" }]);
  });

  it("desvinculación de LW preserva el link de LX intacto", () => {
    const remaining = simulateUnlink(sharedLinks, "LW");
    expect(remaining).toEqual([{ company_id: "LX", role: "Cliente" }]);
  });

  it("contacto en 3 tenants: borrar desde uno deja los otros 2 intactos", () => {
    const tripleLinks = [
      { company_id: "LX", role: "Cliente" },
      { company_id: "LW", role: "Proveedor" },
      { company_id: "LC", role: null },
    ];
    const strategy = resolveDeleteStrategy(tripleLinks, "LW");
    expect(strategy).toBe("UNLINK");

    const remaining = simulateUnlink(tripleLinks, "LW");
    expect(remaining).toHaveLength(2);
    expect(remaining.map((l) => l.company_id)).toEqual(["LX", "LC"]);
  });
});
