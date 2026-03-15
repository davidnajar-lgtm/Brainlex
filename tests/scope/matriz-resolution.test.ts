// ============================================================================
// tests/scope/matriz-resolution.test.ts — Tests de resolución de Matriz VIP
//
// Verifica que la lógica de resolución de contacto-matriz por tenant
// funciona correctamente y respeta el aislamiento CISO.
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Lógica pura extraída para testing ───────────────────────────────────────

interface CompanyLink {
  contacto_id: string;
  company_id:  string;
  role:        string | null;
  contacto: {
    id:             string;
    es_facturadora: boolean;
    status:         string;
  };
}

/**
 * Resuelve el ID del contacto-matriz para un tenant dado.
 * Reglas CISO:
 *   1. El contacto DEBE tener es_facturadora = true
 *   2. El link DEBE tener company_id === tenantId
 *   3. El contacto DEBE estar ACTIVE
 *   4. Si no se encuentra, retorna null (nunca falla con error)
 */
function resolveMatrizId(links: CompanyLink[], tenantId: string): string | null {
  const match = links.find(
    (l) =>
      l.company_id === tenantId &&
      l.contacto.es_facturadora === true &&
      l.contacto.status === "ACTIVE"
  );
  return match?.contacto_id ?? null;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const LINKS: CompanyLink[] = [
  {
    contacto_id: "matriz-lx-001",
    company_id:  "LX",
    role:        "Matriz",
    contacto:    { id: "matriz-lx-001", es_facturadora: true, status: "ACTIVE" },
  },
  {
    contacto_id: "matriz-lw-001",
    company_id:  "LW",
    role:        "Matriz",
    contacto:    { id: "matriz-lw-001", es_facturadora: true, status: "ACTIVE" },
  },
  {
    contacto_id: "cliente-001",
    company_id:  "LX",
    role:        "Cliente activo",
    contacto:    { id: "cliente-001", es_facturadora: false, status: "ACTIVE" },
  },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("resolveMatrizId — Resolución de contacto Matriz por tenant", () => {
  it("resuelve la matriz de LX correctamente", () => {
    expect(resolveMatrizId(LINKS, "LX")).toBe("matriz-lx-001");
  });

  it("resuelve la matriz de LW correctamente", () => {
    expect(resolveMatrizId(LINKS, "LW")).toBe("matriz-lw-001");
  });

  it("CISO: LW nunca ve la matriz de LX", () => {
    // Filtra como si fuera un usuario de LW — solo debería ver su propia matriz
    const lwLinks = LINKS.filter((l) => l.company_id === "LW");
    expect(resolveMatrizId(lwLinks, "LX")).toBeNull();
  });

  it("retorna null si no hay matriz para el tenant", () => {
    expect(resolveMatrizId(LINKS, "XX")).toBeNull();
  });

  it("ignora contactos que no son facturadora", () => {
    const noFacturadora: CompanyLink[] = [{
      contacto_id: "fake-001",
      company_id:  "LX",
      role:        "Matriz",
      contacto:    { id: "fake-001", es_facturadora: false, status: "ACTIVE" },
    }];
    expect(resolveMatrizId(noFacturadora, "LX")).toBeNull();
  });

  it("ignora matrices en QUARANTINE", () => {
    const quarantined: CompanyLink[] = [{
      contacto_id: "q-001",
      company_id:  "LX",
      role:        "Matriz",
      contacto:    { id: "q-001", es_facturadora: true, status: "QUARANTINE" },
    }];
    expect(resolveMatrizId(quarantined, "LX")).toBeNull();
  });

  it("con array vacío retorna null", () => {
    expect(resolveMatrizId([], "LX")).toBeNull();
  });
});
