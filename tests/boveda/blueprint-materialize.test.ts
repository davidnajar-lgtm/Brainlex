// ============================================================================
// tests/boveda/blueprint-materialize.test.ts — TDD: Materialización de Blueprints
//
// @role: @QA-Engineer / @Doc-Specialist
// @spec: Cuando se asigna un Constructor (Departamento/Servicio), se deben
//        crear Carpeta records en BD para que el visor los muestre al instante.
//
// Casos:
//   1. Departamento genera 1 carpeta INTELIGENTE raíz (sin subcarpetas)
//   2. Servicio genera carpeta INTELIGENTE + subcarpetas blueprint (es_blueprint=true)
//   3. Servicio sin blueprint usa subcarpetas por defecto
//   4. Idempotencia: no duplica si carpeta con etiqueta_id ya existe
//   5. Servicio con parent Departamento se anida bajo carpeta del Departamento
//   6. Servicio sin parent o sin carpeta padre se crea en raíz
//   7. Categoría no-Constructor devuelve skip=true
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  planBlueprintCarpetas,
  scopeToCompanyId,
  SUBCARPETAS_DEFAULT,
  type PlanInput,
} from "@/lib/services/blueprintMaterialize.service";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("planBlueprintCarpetas", () => {
  it("Departamento genera 1 carpeta INTELIGENTE raíz", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-dept",
      etiquetaNombre: "Fiscal",
      categoriaNombre: "Departamento",
      blueprint: null,
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
    });

    expect(plan.skip).toBe(false);
    expect(plan.rootCarpeta).toMatchObject({
      nombre: "Fiscal",
      etiqueta_id: "e-dept",
      es_blueprint: false,
      parentCarpetaId: null,
    });
    expect(plan.subcarpetas).toHaveLength(0);
  });

  it("Servicio genera carpeta + subcarpetas blueprint personalizadas", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-irpf",
      etiquetaNombre: "IRPF",
      categoriaNombre: "Servicio",
      blueprint: ["01_Borrador", "02_Declaracion", "03_Resolucion"],
      parentEtiquetaId: "e-dept",
      existingCarpetaEtiquetaIds: new Set(["e-dept"]),
      existingCarpetasByEtiqueta: new Map([["e-dept", "carpeta-fiscal-id"]]),
    });

    expect(plan.skip).toBe(false);
    expect(plan.rootCarpeta).toMatchObject({
      nombre: "IRPF",
      etiqueta_id: "e-irpf",
      es_blueprint: false,
      parentCarpetaId: "carpeta-fiscal-id",
    });
    expect(plan.subcarpetas).toEqual([
      "01_Borrador",
      "02_Declaracion",
      "03_Resolucion",
    ]);
  });

  it("Servicio sin blueprint usa subcarpetas por defecto (ordenadas)", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-iva",
      etiquetaNombre: "IVA",
      categoriaNombre: "Servicio",
      blueprint: null,
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
    });

    expect(plan.subcarpetas).toEqual(SUBCARPETAS_DEFAULT);
    // Verificar que están ordenadas
    const sorted = [...plan.subcarpetas].sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true })
    );
    expect(plan.subcarpetas).toEqual(sorted);
  });

  it("Skip si carpeta con etiqueta_id ya existe (idempotencia)", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-dept",
      etiquetaNombre: "Fiscal",
      categoriaNombre: "Departamento",
      blueprint: null,
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(["e-dept"]),
      existingCarpetasByEtiqueta: new Map([["e-dept", "carpeta-fiscal-id"]]),
    });

    expect(plan.skip).toBe(true);
    expect(plan.rootCarpeta).toBeNull();
    expect(plan.subcarpetas).toHaveLength(0);
  });

  it("Servicio sin Departamento padre se crea en raíz", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-svc",
      etiquetaNombre: "Consulta",
      categoriaNombre: "Servicio",
      blueprint: null,
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
    });

    expect(plan.rootCarpeta?.parentCarpetaId).toBeNull();
  });

  it("Servicio con Departamento padre sin carpeta se crea en raíz", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-svc",
      etiquetaNombre: "Consulta",
      categoriaNombre: "Servicio",
      blueprint: null,
      parentEtiquetaId: "e-dept-sin-carpeta",
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
    });

    expect(plan.rootCarpeta?.parentCarpetaId).toBeNull();
  });

  it("Categoría no-Constructor devuelve skip", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-estado",
      etiquetaNombre: "Activo",
      categoriaNombre: "Estado",
      blueprint: null,
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
    });

    expect(plan.skip).toBe(true);
    expect(plan.rootCarpeta).toBeNull();
  });

  it("Blueprint vacío (array vacío) usa subcarpetas por defecto", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-svc",
      etiquetaNombre: "Servicio X",
      categoriaNombre: "Servicio",
      blueprint: [],
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
    });

    expect(plan.subcarpetas).toEqual(SUBCARPETAS_DEFAULT);
  });

  // ─── Periodicidad: PUNTUAL vs ANUAL ───────────────────────────────────────

  it("Servicio PUNTUAL: subcarpetas cuelgan directamente del servicio (sin carpeta año)", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-irpf",
      etiquetaNombre: "IRPF",
      categoriaNombre: "Servicio",
      blueprint: ["Borrador", "Declaración"],
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
      periodicidad: "PUNTUAL",
    });

    expect(plan.skip).toBe(false);
    expect(plan.yearFolder).toBeNull();
    expect(plan.subcarpetas).toEqual(["Borrador", "Declaración"]);
  });

  it("Servicio ANUAL: genera carpeta de año actual entre servicio y subcarpetas", () => {
    const currentYear = new Date().getFullYear().toString();
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-irpf",
      etiquetaNombre: "IRPF",
      categoriaNombre: "Servicio",
      blueprint: ["Borrador", "Declaración"],
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
      periodicidad: "ANUAL",
    });

    expect(plan.skip).toBe(false);
    expect(plan.yearFolder).toBe(currentYear);
    expect(plan.subcarpetas).toEqual(["Borrador", "Declaración"]);
  });

  it("Servicio sin periodicidad explícita (undefined) se comporta como PUNTUAL", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-svc",
      etiquetaNombre: "Consulta",
      categoriaNombre: "Servicio",
      blueprint: null,
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
    });

    expect(plan.yearFolder).toBeNull();
  });

  it("Departamento ignora periodicidad (nunca genera yearFolder)", () => {
    const plan = planBlueprintCarpetas({
      etiquetaId: "e-dept",
      etiquetaNombre: "Fiscal",
      categoriaNombre: "Departamento",
      blueprint: null,
      parentEtiquetaId: null,
      existingCarpetaEtiquetaIds: new Set(),
      existingCarpetasByEtiqueta: new Map(),
      periodicidad: "ANUAL",
    });

    expect(plan.yearFolder).toBeNull();
    expect(plan.subcarpetas).toHaveLength(0);
  });
});

// ─── scopeToCompanyId ────────────────────────────────────────────────────────

describe("scopeToCompanyId", () => {
  it("LEXCONOMY → LX", () => {
    expect(scopeToCompanyId("LEXCONOMY")).toBe("LX");
  });

  it("LAWTECH → LW", () => {
    expect(scopeToCompanyId("LAWTECH")).toBe("LW");
  });

  it("GLOBAL → null", () => {
    expect(scopeToCompanyId("GLOBAL")).toBeNull();
  });

  it("null → null", () => {
    expect(scopeToCompanyId(null)).toBeNull();
  });

  it("undefined → null", () => {
    expect(scopeToCompanyId(undefined)).toBeNull();
  });
});
