// ============================================================================
// tests/security/cross-tenant-guard.test.ts — TDD: Ataque cross-tenant
//
// @role: @QA-Engineer / @Security-CISO
// @spec: Fase A — Auditoría de Seguridad Multitenant
//
// COBERTURA:
//   C1. moveArchivo — tenant LX no puede mover archivo a carpeta de LW
//   C2. createCarpetaManual — no puede crear hija de carpeta de otro tenant
//   H7. Filiación — no puede eliminar/editar dirección/canal de otro tenant
//
// ESTRATEGIA:
//   Cada test simula un "ataque" donde un usuario de tenant_A intenta
//   mutar datos que pertenecen a tenant_B. Todos deben fallar con error
//   claro y NO mutar el dato.
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── C1: moveArchivo — Protección cross-tenant ─────────────────────────────

describe("C1 — moveArchivo: protección cross-tenant", () => {
  /** Simula la lógica de validación que moveArchivo DEBE implementar. */
  function validateMoveArchivo(input: {
    archivoSourceCarpeta: { company_id: string | null };
    targetCarpeta: { company_id: string | null };
    companyId: string | null;
  }): { allowed: boolean; error?: string } {
    const { archivoSourceCarpeta, targetCarpeta, companyId } = input;

    // Guard 1: el archivo origen debe pertenecer al tenant solicitante
    if (companyId && archivoSourceCarpeta.company_id &&
        archivoSourceCarpeta.company_id !== companyId) {
      return {
        allowed: false,
        error: `El archivo pertenece a ${archivoSourceCarpeta.company_id}. No se puede mover desde ${companyId}.`,
      };
    }

    // Guard 2: la carpeta destino debe pertenecer al mismo tenant
    if (companyId && targetCarpeta.company_id &&
        targetCarpeta.company_id !== companyId) {
      return {
        allowed: false,
        error: `La carpeta destino pertenece a ${targetCarpeta.company_id}. No se puede mover desde ${companyId}.`,
      };
    }

    return { allowed: true };
  }

  it("ATAQUE: LX no puede mover archivo a carpeta de LW", () => {
    const result = validateMoveArchivo({
      archivoSourceCarpeta: { company_id: "LX" },
      targetCarpeta: { company_id: "LW" },
      companyId: "LX",
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/LW/);
  });

  it("ATAQUE: LW no puede mover archivo de LX", () => {
    const result = validateMoveArchivo({
      archivoSourceCarpeta: { company_id: "LX" },
      targetCarpeta: { company_id: "LW" },
      companyId: "LW",
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/LX/);
  });

  it("PERMITIDO: LX mueve archivo dentro de sus propias carpetas", () => {
    const result = validateMoveArchivo({
      archivoSourceCarpeta: { company_id: "LX" },
      targetCarpeta: { company_id: "LX" },
      companyId: "LX",
    });
    expect(result.allowed).toBe(true);
  });

  it("PERMITIDO: carpetas sin company_id (legacy) son accesibles", () => {
    const result = validateMoveArchivo({
      archivoSourceCarpeta: { company_id: null },
      targetCarpeta: { company_id: null },
      companyId: "LX",
    });
    expect(result.allowed).toBe(true);
  });

  it("PERMITIDO: sin companyId (SuperAdmin) puede mover entre tenants", () => {
    const result = validateMoveArchivo({
      archivoSourceCarpeta: { company_id: "LX" },
      targetCarpeta: { company_id: "LW" },
      companyId: null,
    });
    expect(result.allowed).toBe(true);
  });
});

// ─── C2: createCarpetaManual — Validación de carpeta padre ─────────────────

describe("C2 — createCarpetaManual: validación tenant de carpeta padre", () => {
  /** Simula la validación que createCarpetaManual DEBE hacer sobre parentId. */
  function validateCreateCarpetaParent(input: {
    parentCarpeta: { company_id: string | null } | null;
    companyId: string | null;
  }): { allowed: boolean; error?: string } {
    const { parentCarpeta, companyId } = input;

    // Sin padre → OK (carpeta raíz)
    if (!parentCarpeta) return { allowed: true };

    // Padre existe: validar tenant
    if (companyId && parentCarpeta.company_id &&
        parentCarpeta.company_id !== companyId) {
      return {
        allowed: false,
        error: `La carpeta padre pertenece a ${parentCarpeta.company_id}. No se puede crear dentro desde ${companyId}.`,
      };
    }

    return { allowed: true };
  }

  it("ATAQUE: LX no puede crear carpeta dentro de carpeta de LW", () => {
    const result = validateCreateCarpetaParent({
      parentCarpeta: { company_id: "LW" },
      companyId: "LX",
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/LW/);
  });

  it("PERMITIDO: LX crea carpeta dentro de carpeta de LX", () => {
    const result = validateCreateCarpetaParent({
      parentCarpeta: { company_id: "LX" },
      companyId: "LX",
    });
    expect(result.allowed).toBe(true);
  });

  it("PERMITIDO: crear carpeta raíz (sin padre)", () => {
    const result = validateCreateCarpetaParent({
      parentCarpeta: null,
      companyId: "LX",
    });
    expect(result.allowed).toBe(true);
  });

  it("PERMITIDO: carpeta padre sin company_id (legacy)", () => {
    const result = validateCreateCarpetaParent({
      parentCarpeta: { company_id: null },
      companyId: "LX",
    });
    expect(result.allowed).toBe(true);
  });
});

// ─── H7: Filiación — Protección cross-tenant en direcciones y canales ──────

describe("H7 — Filiación: protección cross-tenant", () => {
  /**
   * Simula la validación que las funciones de filiación DEBEN implementar.
   * Un contacto puede estar vinculado a LX, LW o ambos.
   * Solo se permite mutar dirección/canal si el contacto está vinculado
   * al tenant que solicita la operación.
   */
  function validateFiliacionAccess(input: {
    contactoLinks: { company_id: string }[];
    companyId: string | null;
  }): { allowed: boolean; error?: string } {
    const { contactoLinks, companyId } = input;

    // Sin companyId → SuperAdmin, permitido
    if (!companyId) return { allowed: true };

    // Verificar que el contacto está vinculado al tenant solicitante
    const hasLink = contactoLinks.some((l) => l.company_id === companyId);
    if (!hasLink) {
      return {
        allowed: false,
        error: `El contacto no está vinculado a ${companyId}. Operación denegada.`,
      };
    }

    return { allowed: true };
  }

  it("ATAQUE: LW no puede editar dirección de contacto solo en LX", () => {
    const result = validateFiliacionAccess({
      contactoLinks: [{ company_id: "LX" }],
      companyId: "LW",
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/LW/);
  });

  it("ATAQUE: LX no puede eliminar canal de contacto solo en LW", () => {
    const result = validateFiliacionAccess({
      contactoLinks: [{ company_id: "LW" }],
      companyId: "LX",
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/LX/);
  });

  it("PERMITIDO: LX edita dirección de contacto vinculado a LX", () => {
    const result = validateFiliacionAccess({
      contactoLinks: [{ company_id: "LX" }],
      companyId: "LX",
    });
    expect(result.allowed).toBe(true);
  });

  it("PERMITIDO: contacto compartido (LX+LW) — ambos tenants pueden operar", () => {
    const links = [{ company_id: "LX" }, { company_id: "LW" }];

    expect(validateFiliacionAccess({ contactoLinks: links, companyId: "LX" }).allowed).toBe(true);
    expect(validateFiliacionAccess({ contactoLinks: links, companyId: "LW" }).allowed).toBe(true);
  });

  it("PERMITIDO: SuperAdmin (sin companyId) opera sobre cualquier contacto", () => {
    const result = validateFiliacionAccess({
      contactoLinks: [{ company_id: "LX" }],
      companyId: null,
    });
    expect(result.allowed).toBe(true);
  });

  it("ATAQUE: contacto sin links (huérfano) — nadie puede operar", () => {
    const result = validateFiliacionAccess({
      contactoLinks: [],
      companyId: "LX",
    });
    expect(result.allowed).toBe(false);
  });
});
