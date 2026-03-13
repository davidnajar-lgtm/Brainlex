// ============================================================================
// tests/boveda/carpeta-tree.test.ts
//
// @role:   @QA-Engineer / @Doc-Specialist
// @spec:   Visor de Bóveda — Modelo de Carpetas (INTELIGENTE | MANUAL)
//
// COBERTURA:
//   1. buildCarpetaTree construye árbol jerárquico desde flat list
//   2. Carpetas INTELIGENTE tienen etiqueta_id, MANUAL no
//   3. Carpetas blueprint son inmutables (es_blueprint=true)
//   4. Subcarpetas ordenadas por `orden` ASC
//   5. Nesting multinivel (parent → children)
//   6. Archivos incluidos en sus carpetas
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  buildCarpetaTree,
  type CarpetaNode,
  type CarpetaFlat,
} from "@/lib/services/bovedaTree.service";

// ─── Datos de prueba ────────────────────────────────────────────────────────

const FLAT_CARPETAS: CarpetaFlat[] = [
  // Departamento Fiscal (INTELIGENTE, raíz)
  {
    id: "c1",
    nombre: "Fiscal",
    tipo: "INTELIGENTE",
    contacto_id: "cto1",
    parent_id: null,
    etiqueta_id: "et-fiscal",
    es_blueprint: false,
    orden: 0,
    archivos: [],
  },
  // Servicio IRPF dentro de Fiscal (INTELIGENTE)
  {
    id: "c2",
    nombre: "IRPF",
    tipo: "INTELIGENTE",
    contacto_id: "cto1",
    parent_id: "c1",
    etiqueta_id: "et-irpf",
    es_blueprint: false,
    orden: 0,
    archivos: [],
  },
  // Subcarpeta blueprint "Borrador" dentro de IRPF
  {
    id: "c3",
    nombre: "Borrador",
    tipo: "INTELIGENTE",
    contacto_id: "cto1",
    parent_id: "c2",
    etiqueta_id: null,
    es_blueprint: true,
    orden: 0,
    archivos: [
      { id: "a1", nombre: "declaracion.pdf", mime_type: "application/pdf", size_bytes: 1024 },
    ],
  },
  // Subcarpeta blueprint "Resolución" dentro de IRPF
  {
    id: "c4",
    nombre: "Resolución",
    tipo: "INTELIGENTE",
    contacto_id: "cto1",
    parent_id: "c2",
    etiqueta_id: null,
    es_blueprint: true,
    orden: 1,
    archivos: [],
  },
  // Carpeta manual (huérfana) — libre
  {
    id: "c5",
    nombre: "Mis Documentos",
    tipo: "MANUAL",
    contacto_id: "cto1",
    parent_id: null,
    etiqueta_id: null,
    es_blueprint: false,
    orden: 1,
    archivos: [
      { id: "a2", nombre: "contrato.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 2048 },
      { id: "a3", nombre: "foto.jpg", mime_type: "image/jpeg", size_bytes: 500000 },
    ],
  },
];

// ─── Construcción del árbol ─────────────────────────────────────────────────

describe("buildCarpetaTree — construye árbol jerárquico desde flat list", () => {
  it("genera 2 nodos raíz (Fiscal + Mis Documentos)", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.nombre)).toEqual(["Fiscal", "Mis Documentos"]);
  });

  it("Fiscal contiene IRPF como hijo", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    expect(fiscal.children).toHaveLength(1);
    expect(fiscal.children[0].nombre).toBe("IRPF");
  });

  it("IRPF contiene 2 subcarpetas blueprint ordenadas por `orden`", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    const irpf = fiscal.children[0];
    expect(irpf.children).toHaveLength(2);
    expect(irpf.children[0].nombre).toBe("Borrador");
    expect(irpf.children[1].nombre).toBe("Resolución");
  });

  it("subcarpetas blueprint marcadas como es_blueprint=true", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    const irpf = fiscal.children[0];
    expect(irpf.children.every((c) => c.es_blueprint)).toBe(true);
  });

  it("archivos incluidos en su carpeta correspondiente", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    const borrador = fiscal.children[0].children[0];
    expect(borrador.archivos).toHaveLength(1);
    expect(borrador.archivos[0].nombre).toBe("declaracion.pdf");
  });

  it("carpeta MANUAL tiene archivos y no tiene etiqueta_id", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const manual = tree.find((n) => n.nombre === "Mis Documentos")!;
    expect(manual.tipo).toBe("MANUAL");
    expect(manual.etiqueta_id).toBeNull();
    expect(manual.archivos).toHaveLength(2);
  });

  it("lista vacía devuelve árbol vacío", () => {
    const tree = buildCarpetaTree([]);
    expect(tree).toHaveLength(0);
  });

  it("ordena nodos del mismo nivel por `orden` ASC", () => {
    const reversed: CarpetaFlat[] = [
      { id: "x1", nombre: "B", tipo: "MANUAL", contacto_id: "cto1", parent_id: null, etiqueta_id: null, es_blueprint: false, orden: 2, archivos: [] },
      { id: "x2", nombre: "A", tipo: "MANUAL", contacto_id: "cto1", parent_id: null, etiqueta_id: null, es_blueprint: false, orden: 0, archivos: [] },
      { id: "x3", nombre: "C", tipo: "MANUAL", contacto_id: "cto1", parent_id: null, etiqueta_id: null, es_blueprint: false, orden: 1, archivos: [] },
    ];
    const tree = buildCarpetaTree(reversed);
    expect(tree.map((n) => n.nombre)).toEqual(["A", "C", "B"]);
  });
});

// ─── Validación de tipos ────────────────────────────────────────────────────

describe("CarpetaNode — propiedades de tipo correctas", () => {
  it("INTELIGENTE tiene etiqueta_id", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    expect(fiscal.tipo).toBe("INTELIGENTE");
    expect(fiscal.etiqueta_id).toBe("et-fiscal");
  });

  it("nodos profundos conservan su tipo", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    const irpf = fiscal.children[0];
    expect(irpf.tipo).toBe("INTELIGENTE");
    expect(irpf.etiqueta_id).toBe("et-irpf");
  });
});

// ─── Inmutabilidad blueprint ────────────────────────────────────────────────

describe("Blueprint — carpetas inmutables", () => {
  it("carpetas raíz INTELIGENTE no son blueprint (son el servicio)", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    expect(fiscal.es_blueprint).toBe(false);
    expect(fiscal.children[0].es_blueprint).toBe(false); // IRPF = servicio, no blueprint
  });

  it("solo las subcarpetas de servicio generadas por blueprint tienen es_blueprint=true", () => {
    const tree = buildCarpetaTree(FLAT_CARPETAS);
    const fiscal = tree.find((n) => n.nombre === "Fiscal")!;
    const irpf = fiscal.children[0];
    const blueprintChildren = irpf.children.filter((c) => c.es_blueprint);
    expect(blueprintChildren).toHaveLength(2);
  });
});
