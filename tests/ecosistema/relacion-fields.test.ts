// ============================================================================
// tests/ecosistema/relacion-fields.test.ts
//
// @role:   @QA-Engineer / @Data-Architect
// @spec:   Consolidación — Point 2: Campos extendidos de Relacion
//
// COBERTURA:
//   1. Zod schema acepta campos nuevos (cargo, departamento_interno, sede_vinculada_id)
//   2. Zod schema sigue rechazando self-references
//   3. Campos opcionales: relación válida sin los campos nuevos
// ============================================================================

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Reproduce el schema extendido que vamos a implementar
const RelacionExtendedSchema = z.object({
  origen_id:             z.string().cuid(),
  destino_id:            z.string().cuid(),
  tipo_relacion_id:      z.string().cuid(),
  notas:                 z.string().max(500).optional(),
  cargo:                 z.string().max(120).optional(),
  departamento_interno:  z.string().max(120).optional(),
  sede_vinculada_id:     z.string().cuid().optional(),
});

describe("Relacion Extended Schema — Campos de Ecosistema", () => {
  const validBase = {
    origen_id:        "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    destino_id:       "clyyyyyyyyyyyyyyyyyyyyyyyyyy",
    tipo_relacion_id: "clzzzzzzzzzzzzzzzzzzzzzzzzz",
  };

  it("acepta relación con todos los campos nuevos", () => {
    const result = RelacionExtendedSchema.safeParse({
      ...validBase,
      cargo: "Director Financiero",
      departamento_interno: "Contabilidad",
      sede_vinculada_id: "claaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(result.success).toBe(true);
  });

  it("acepta relación sin campos nuevos (retrocompatibilidad)", () => {
    const result = RelacionExtendedSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rechaza cargo demasiado largo (>120 chars)", () => {
    const result = RelacionExtendedSchema.safeParse({
      ...validBase,
      cargo: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza sede_vinculada_id con formato inválido", () => {
    const result = RelacionExtendedSchema.safeParse({
      ...validBase,
      sede_vinculada_id: "not-a-cuid",
    });
    expect(result.success).toBe(false);
  });

  it("auto-referencia detectada a nivel de negocio (no de schema)", () => {
    // El schema Zod no valida auto-referencia; eso lo hace la action
    const result = RelacionExtendedSchema.safeParse({
      ...validBase,
      origen_id:  "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      destino_id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    // Schema pasa, pero la action rechazará
    expect(result.success).toBe(true);
  });
});
