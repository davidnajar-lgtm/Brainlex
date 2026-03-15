// ============================================================================
// tests/egoGraph/egoGraph.test.ts — TDD para buildEgoGraph
//
// @role: @QA-Engineer / @Data-Architect
// @spec: FASE 14.01 — Grafo Egocéntrico: transformación de datos
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildEgoGraph, type GraphNode, type GraphEdge } from "@/lib/modules/entidades/utils/egoGraph";
import { ContactoTipo, EtiquetaScope } from "@prisma/client";

// ─── Helpers para construir datos de prueba ──────────────────────────────────

function makeTipoRelacion(overrides: Partial<{ id: string; nombre: string; color: string; categoria: string }> = {}) {
  return {
    id: overrides.id ?? "tr1",
    nombre: overrides.nombre ?? "Socio",
    color: overrides.color ?? "#FF8C00",
    categoria: overrides.categoria ?? "Societaria",
    descripcion: null,
    es_sistema: false,
    scope: EtiquetaScope.GLOBAL,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeContactoMin(overrides: Partial<{ id: string; nombre: string | null; apellido1: string | null; razon_social: string | null; tipo: ContactoTipo }> = {}) {
  return {
    id: overrides.id ?? "c1",
    nombre: overrides.nombre ?? "Juan",
    apellido1: overrides.apellido1 ?? "Pérez",
    razon_social: overrides.razon_social ?? null,
    tipo: overrides.tipo ?? ContactoTipo.PERSONA_FISICA,
  };
}

function makeRelacion(overrides: {
  id?: string;
  origen?: ReturnType<typeof makeContactoMin>;
  destino?: ReturnType<typeof makeContactoMin>;
  tipo_relacion?: ReturnType<typeof makeTipoRelacion>;
  cargo?: string | null;
  porcentaje?: number | null;
  notas?: string | null;
} = {}) {
  const origen = overrides.origen ?? makeContactoMin({ id: "center" });
  const destino = overrides.destino ?? makeContactoMin({ id: "c2", nombre: "Ana", apellido1: "López" });
  const tipo = overrides.tipo_relacion ?? makeTipoRelacion();
  return {
    id: overrides.id ?? "rel1",
    origen_id: origen.id,
    destino_id: destino.id,
    tipo_relacion_id: tipo.id,
    notas: overrides.notas ?? null,
    cargo: overrides.cargo ?? null,
    departamento_interno: null,
    sede_vinculada_id: null,
    porcentaje: overrides.porcentaje ?? null,
    activa: true,
    archivada_at: null,
    archivo_motivo: null,
    created_at: new Date(),
    updated_at: new Date(),
    tipo_relacion: tipo,
    origen,
    destino,
    sede_vinculada: null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildEgoGraph — transformación RelacionCompleta[] → nodes/edges", () => {
  it("con array vacío retorna solo el nodo central sin edges", () => {
    const { nodes, edges } = buildEgoGraph("center", "Mi Empresa", []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].isCenter).toBe(true);
    expect(nodes[0].id).toBe("center");
    expect(nodes[0].displayName).toBe("Mi Empresa");
    expect(edges).toHaveLength(0);
  });

  it("una relación produce 2 nodos + 1 edge con propiedades correctas", () => {
    const rel = makeRelacion({
      cargo: "Director",
      porcentaje: 51,
    });
    const { nodes, edges } = buildEgoGraph("center", "Centro", [rel]);

    expect(nodes).toHaveLength(2);
    const center = nodes.find((n) => n.isCenter);
    const other = nodes.find((n) => !n.isCenter);
    expect(center?.id).toBe("center");
    expect(other?.id).toBe("c2");
    expect(other?.displayName).toBe("Ana López");

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("center");
    expect(edges[0].target).toBe("c2");
    expect(edges[0].cargo).toBe("Director");
    expect(edges[0].porcentaje).toBe(51);
    expect(edges[0].tipoNombre).toBe("Socio");
    expect(edges[0].tipoColor).toBe("#FF8C00");
    expect(edges[0].categoria).toBe("Societaria");
  });

  it("múltiples relaciones al mismo contacto producen 1 nodo periférico + N edges", () => {
    const destino = makeContactoMin({ id: "c2", nombre: "Ana", apellido1: "López" });
    const rel1 = makeRelacion({ id: "r1", destino, tipo_relacion: makeTipoRelacion({ id: "t1", nombre: "Socio", categoria: "Societaria" }) });
    const rel2 = makeRelacion({ id: "r2", destino, tipo_relacion: makeTipoRelacion({ id: "t2", nombre: "Asesor", categoria: "Laboral" }) });

    const { nodes, edges } = buildEgoGraph("center", "Centro", [rel1, rel2]);

    // Solo 2 nodos (center + c2), no 3
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(2);
    expect(edges[0].tipoNombre).toBe("Socio");
    expect(edges[1].tipoNombre).toBe("Asesor");
  });

  it("el cluster del nodo se asigna a la categoría más frecuente", () => {
    const destino = makeContactoMin({ id: "c2" });
    const rel1 = makeRelacion({ id: "r1", destino, tipo_relacion: makeTipoRelacion({ categoria: "Societaria" }) });
    const rel2 = makeRelacion({ id: "r2", destino, tipo_relacion: makeTipoRelacion({ categoria: "Societaria" }) });
    const rel3 = makeRelacion({ id: "r3", destino, tipo_relacion: makeTipoRelacion({ categoria: "Laboral" }) });

    const { nodes } = buildEgoGraph("center", "Centro", [rel1, rel2, rel3]);
    const peripheral = nodes.find((n) => !n.isCenter);

    expect(peripheral?.clusterGroup).toBe("Societaria");
  });

  it("relaciones bidireccionales (contacto es origen y destino) se manejan correctamente", () => {
    const center = makeContactoMin({ id: "center", nombre: "Centro" });
    const other = makeContactoMin({ id: "c2", nombre: "Otro" });

    const rel1 = makeRelacion({ id: "r1", origen: center, destino: other });
    const rel2 = makeRelacion({ id: "r2", origen: other, destino: center });

    const { nodes, edges } = buildEgoGraph("center", "Centro", [rel1, rel2]);

    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(2);
    // Ambos edges apuntan entre center y c2
    expect(edges.every((e) => (e.source === "center" && e.target === "c2") || (e.source === "c2" && e.target === "center"))).toBe(true);
  });

  it("Persona Jurídica muestra razon_social como displayName", () => {
    const destino = makeContactoMin({
      id: "pj1",
      nombre: null,
      apellido1: null,
      razon_social: "Lexconomy SL",
      tipo: ContactoTipo.PERSONA_JURIDICA,
    });
    const rel = makeRelacion({ destino });
    const { nodes } = buildEgoGraph("center", "Centro", [rel]);
    const pj = nodes.find((n) => n.id === "pj1");

    expect(pj?.displayName).toBe("Lexconomy SL");
    expect(pj?.tipo).toBe("PERSONA_JURIDICA");
  });

  it("el nodo central no se duplica si aparece como origen y destino", () => {
    const center = makeContactoMin({ id: "center" });
    const a = makeContactoMin({ id: "a" });
    const b = makeContactoMin({ id: "b" });

    const rel1 = makeRelacion({ id: "r1", origen: center, destino: a });
    const rel2 = makeRelacion({ id: "r2", origen: b, destino: center });

    const { nodes } = buildEgoGraph("center", "Centro", [rel1, rel2]);
    const centerNodes = nodes.filter((n) => n.id === "center");

    expect(centerNodes).toHaveLength(1);
    expect(nodes).toHaveLength(3); // center + a + b
  });

  it("edge label combina cargo y porcentaje correctamente", () => {
    const rel = makeRelacion({ cargo: "Socio Fundador", porcentaje: 33.5 });
    const { edges } = buildEgoGraph("center", "Centro", [rel]);

    expect(edges[0].label).toBe("Socio Fundador (33.5%)");
  });

  it("edge label con solo cargo", () => {
    const rel = makeRelacion({ cargo: "Director", porcentaje: null });
    const { edges } = buildEgoGraph("center", "Centro", [rel]);

    expect(edges[0].label).toBe("Director");
  });

  it("edge label con solo porcentaje", () => {
    const rel = makeRelacion({ cargo: null, porcentaje: 100 });
    const { edges } = buildEgoGraph("center", "Centro", [rel]);

    expect(edges[0].label).toBe("100%");
  });

  it("edge label vacío si no hay cargo ni porcentaje", () => {
    const rel = makeRelacion({ cargo: null, porcentaje: null });
    const { edges } = buildEgoGraph("center", "Centro", [rel]);

    expect(edges[0].label).toBe("Socio"); // fallback a tipo_relacion.nombre
  });

  it("relationCount refleja el número de relaciones del nodo periférico", () => {
    const dest = makeContactoMin({ id: "c2" });
    const rels = [
      makeRelacion({ id: "r1", destino: dest }),
      makeRelacion({ id: "r2", destino: dest }),
      makeRelacion({ id: "r3", destino: dest }),
    ];
    const { nodes } = buildEgoGraph("center", "Centro", rels);
    const peripheral = nodes.find((n) => n.id === "c2");

    expect(peripheral?.relationCount).toBe(3);
  });
});
