// ============================================================================
// tests/ecosistema/blueprint-trigger.test.ts
//
// @role:   @QA-Engineer / @Doc-Specialist
// @spec:   Consolidacion Point 0 — Blueprint Trigger Detection
//
// COBERTURA:
//   1. detectBlueprintTrigger genera plan correcto con constructores
//   2. Plan vacio cuando no hay constructores
//   3. shouldTriggerBlueprint detecta Departamento y Servicio
//   4. shouldTriggerBlueprint detecta anos (etiquetas temporales)
//   5. shouldTriggerBlueprint ignora atributos no-constructor
//   6. Blueprint custom tiene prioridad sobre subcarpetas default
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  detectBlueprintTrigger,
  shouldTriggerBlueprint,
  type BlueprintAssignment,
} from "@/lib/services/blueprintTrigger.service";

describe("BlueprintTrigger — Deteccion de planes de Drive", () => {
  const BASE_ASSIGNMENTS: BlueprintAssignment[] = [
    {
      etiquetaId: "dept1",
      etiquetaNombre: "Fiscal",
      categoriaNombre: "Departamento",
      blueprint: null,
      parentId: null,
    },
    {
      etiquetaId: "svc1",
      etiquetaNombre: "IRPF",
      categoriaNombre: "Servicio",
      blueprint: ["01_Borrador", "02_Declaracion", "03_Resolucion"],
      parentId: "dept1",
    },
  ];

  it("genera plan con carpeta raiz cuando hay constructores", () => {
    const plan = detectBlueprintTrigger("c1", "Juan Garcia", BASE_ASSIGNMENTS);
    expect(plan.shouldCreateRoot).toBe(true);
    expect(plan.departmentFolders).toHaveLength(1);
    expect(plan.departmentFolders[0].name).toBe("Fiscal");
    expect(plan.serviceFolders).toHaveLength(1);
    expect(plan.serviceFolders[0].name).toBe("IRPF");
    expect(plan.totalFoldersToCreate).toBeGreaterThan(0);
  });

  it("plan vacio cuando no hay constructores asignados", () => {
    const atributos: BlueprintAssignment[] = [
      {
        etiquetaId: "attr1",
        etiquetaNombre: "VIP",
        categoriaNombre: "Inteligencia",
        blueprint: null,
        parentId: null,
      },
    ];
    const plan = detectBlueprintTrigger("c2", "Test", atributos);
    expect(plan.shouldCreateRoot).toBe(false);
    expect(plan.totalFoldersToCreate).toBe(0);
    expect(plan.serviceFolders).toHaveLength(0);
  });

  it("detecta anos en la lista de etiquetas", () => {
    const withYear: BlueprintAssignment[] = [
      ...BASE_ASSIGNMENTS,
      {
        etiquetaId: "year1",
        etiquetaNombre: "2025",
        categoriaNombre: "Estado",
        blueprint: null,
        parentId: null,
      },
    ];
    const plan = detectBlueprintTrigger("c3", "Test", withYear);
    expect(plan.yearFolders).toContain("2025");
    expect(plan.yearFolders).toHaveLength(1);
  });

  it("blueprint custom tiene prioridad sobre default", () => {
    const plan = detectBlueprintTrigger("c4", "Test", BASE_ASSIGNMENTS);
    const irpfService = plan.serviceFolders.find((s) => s.name === "IRPF");
    expect(irpfService).toBeDefined();
    expect(irpfService!.subcarpetas).toEqual(["01_Borrador", "02_Declaracion", "03_Resolucion"]);
  });

  it("servicio sin blueprint usa subcarpetas default", () => {
    const noBlueprint: BlueprintAssignment[] = [
      {
        etiquetaId: "svc2",
        etiquetaNombre: "Contabilidad",
        categoriaNombre: "Servicio",
        blueprint: null,
        parentId: null,
      },
    ];
    const plan = detectBlueprintTrigger("c5", "Test", noBlueprint);
    const svc = plan.serviceFolders[0];
    // Default subcarpetas (no sort — detection only, driveMock sorts on execution)
    expect(svc.subcarpetas).toEqual(["Documentacion", "Presupuestos", "Facturacion"]);
  });

  it("parentDepartment se resuelve correctamente", () => {
    const plan = detectBlueprintTrigger("c6", "Test", BASE_ASSIGNMENTS);
    expect(plan.serviceFolders[0].parentDepartment).toBe("Fiscal");
  });
});

describe("shouldTriggerBlueprint — Deteccion de evento", () => {
  it("retorna true para Departamento", () => {
    expect(shouldTriggerBlueprint("Departamento", "Fiscal")).toBe(true);
  });

  it("retorna true para Servicio", () => {
    expect(shouldTriggerBlueprint("Servicio", "IRPF")).toBe(true);
  });

  it("retorna true para ano temporal", () => {
    expect(shouldTriggerBlueprint("Estado", "2025")).toBe(true);
  });

  it("retorna false para atributo normal", () => {
    expect(shouldTriggerBlueprint("Inteligencia", "VIP")).toBe(false);
  });

  it("retorna false para Identidad", () => {
    expect(shouldTriggerBlueprint("Identidad", "Autonomo")).toBe(false);
  });
});
