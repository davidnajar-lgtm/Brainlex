// ============================================================================
// tests/ecosistema/clone-structure.test.ts
//
// @role:   @QA-Engineer / @Data-Architect
// @spec:   Consolidacion Point 3 — Clonar estructura de otro contacto
//
// COBERTURA:
//   1. buildClonePlan genera plan correcto con etiquetas del origen
//   2. Plan vacio cuando el origen no tiene etiquetas
//   3. No clona etiquetas que el destino ya tiene (deduplicacion)
//   4. Incluye info de blueprint en las etiquetas Constructor
// ============================================================================

import { describe, it, expect } from "vitest";

// ── Tipo simulado para el plan de clonacion ─────────────────────────────────

interface ClonePlanItem {
  etiquetaId:   string;
  nombre:       string;
  categoria:    string;
  hasBlueprint: boolean;
}

interface ClonePlan {
  sourceId:       string;
  targetId:       string;
  toClone:        ClonePlanItem[];
  alreadyPresent: string[]; // etiqueta IDs que el destino ya tiene
  total:          number;
}

function buildClonePlan(
  sourceEtiquetas: { etiquetaId: string; nombre: string; categoria: string; hasBlueprint: boolean }[],
  targetEtiquetaIds: Set<string>,
  sourceId: string,
  targetId: string
): ClonePlan {
  const toClone: ClonePlanItem[] = [];
  const alreadyPresent: string[] = [];

  for (const et of sourceEtiquetas) {
    if (targetEtiquetaIds.has(et.etiquetaId)) {
      alreadyPresent.push(et.etiquetaId);
    } else {
      toClone.push(et);
    }
  }

  return {
    sourceId,
    targetId,
    toClone,
    alreadyPresent,
    total: toClone.length,
  };
}

describe("Clone Structure — Plan de clonacion", () => {
  const sourceEtiquetas = [
    { etiquetaId: "et1", nombre: "Fiscal", categoria: "Departamento", hasBlueprint: false },
    { etiquetaId: "et2", nombre: "IRPF", categoria: "Servicio", hasBlueprint: true },
    { etiquetaId: "et3", nombre: "VIP", categoria: "Inteligencia", hasBlueprint: false },
  ];

  it("genera plan con todas las etiquetas del origen cuando destino esta vacio", () => {
    const plan = buildClonePlan(sourceEtiquetas, new Set(), "c1", "c2");
    expect(plan.toClone).toHaveLength(3);
    expect(plan.alreadyPresent).toHaveLength(0);
    expect(plan.total).toBe(3);
  });

  it("plan vacio cuando origen no tiene etiquetas", () => {
    const plan = buildClonePlan([], new Set(), "c1", "c2");
    expect(plan.toClone).toHaveLength(0);
    expect(plan.total).toBe(0);
  });

  it("deduplica etiquetas que el destino ya tiene", () => {
    const targetIds = new Set(["et1", "et3"]); // ya tiene Fiscal y VIP
    const plan = buildClonePlan(sourceEtiquetas, targetIds, "c1", "c2");
    expect(plan.toClone).toHaveLength(1);
    expect(plan.toClone[0].nombre).toBe("IRPF");
    expect(plan.alreadyPresent).toEqual(["et1", "et3"]);
  });

  it("identifica etiquetas con blueprint", () => {
    const plan = buildClonePlan(sourceEtiquetas, new Set(), "c1", "c2");
    const irpf = plan.toClone.find((e) => e.nombre === "IRPF");
    expect(irpf?.hasBlueprint).toBe(true);
  });

  it("sourceId y targetId correctos en el plan", () => {
    const plan = buildClonePlan(sourceEtiquetas, new Set(), "src1", "dst1");
    expect(plan.sourceId).toBe("src1");
    expect(plan.targetId).toBe("dst1");
  });
});
