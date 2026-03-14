// ============================================================================
// tests/boveda/boveda-zip.test.ts — TDD: Descarga ZIP con filtrado de seguridad
//
// @role: @QA-Engineer / @Security-CISO
// @spec: Descarga recursiva ZIP — filtrado solo_super_admin + herencia
//
// Casos:
//   1. SuperAdmin recibe TODAS las carpetas/archivos en el ZIP
//   2. Staff NO recibe carpetas con etiqueta solo_super_admin=true
//   3. Staff NO recibe carpetas hijas de departamento restringido (herencia)
//   4. Carpetas MANUAL (sin etiqueta) siempre incluidas
//   5. El ZIP replica la jerarquía de carpetas
//   6. Archivos vacíos generan entrada en el ZIP (placeholder)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  filterCarpetasForZip,
  buildZipPaths,
  type CarpetaZipNode,
} from "@/lib/services/bovedaZip.service";
import type { UserSecurityContext } from "@/lib/services/securityFilter.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const superAdmin: UserSecurityContext = { userId: "sa-1", role: "SUPER_ADMIN" };
const staff: UserSecurityContext = { userId: "st-1", role: "STAFF" };
const admin: UserSecurityContext = { userId: "ad-1", role: "ADMIN" };

/** Helper: crea un nodo de carpeta para tests. */
function node(
  overrides: Partial<CarpetaZipNode> & { id: string; nombre: string },
): CarpetaZipNode {
  return {
    tipo: "INTELIGENTE",
    etiqueta_id: null,
    es_blueprint: false,
    orden: 0,
    solo_super_admin: false,
    parent_etiqueta_solo_super_admin: false,
    archivos: [],
    children: [],
    ...overrides,
  };
}

// ─── Fixtures de árbol ──────────────────────────────────────────────────────

function buildTestTree(): CarpetaZipNode[] {
  return [
    // Departamento público
    node({
      id: "dept-pub",
      nombre: "Fiscal",
      children: [
        node({
          id: "serv-pub",
          nombre: "Declaración IVA",
          children: [
            node({
              id: "bp-1",
              nombre: "Documentos",
              es_blueprint: true,
              archivos: [
                { id: "f1", nombre: "factura.pdf", mime_type: "application/pdf", size_bytes: 1024 },
              ],
            }),
          ],
        }),
      ],
    }),
    // Departamento RESTRINGIDO (solo_super_admin=true)
    node({
      id: "dept-secret",
      nombre: "Penal",
      solo_super_admin: true,
      children: [
        node({
          id: "serv-secret-child",
          nombre: "Defensa Penal",
          parent_etiqueta_solo_super_admin: true,
          archivos: [
            { id: "f2", nombre: "expediente-secreto.pdf", mime_type: "application/pdf", size_bytes: 2048 },
          ],
        }),
      ],
    }),
    // Servicio con solo_super_admin directo (sin heredar)
    node({
      id: "serv-restricted",
      nombre: "Auditoría Interna",
      solo_super_admin: true,
      archivos: [
        { id: "f3", nombre: "informe.xlsx", mime_type: "application/vnd.ms-excel", size_bytes: 512 },
      ],
    }),
    // Carpeta MANUAL (sin etiqueta) — siempre visible
    node({
      id: "manual-1",
      nombre: "Documentos Varios",
      tipo: "MANUAL",
      archivos: [
        { id: "f4", nombre: "nota.txt", mime_type: "text/plain", size_bytes: 64 },
      ],
    }),
  ];
}

// ─── Tests de Filtrado ─────────────────────────────────────────────────────

describe("filterCarpetasForZip", () => {
  it("SuperAdmin recibe TODAS las carpetas sin filtrar", () => {
    const tree = buildTestTree();
    const filtered = filterCarpetasForZip(tree, superAdmin);

    expect(filtered).toHaveLength(4);
    // Dept restringido presente
    const deptSecret = filtered.find((n) => n.id === "dept-secret");
    expect(deptSecret).toBeDefined();
    expect(deptSecret!.children).toHaveLength(1);
  });

  it("Staff NO recibe carpetas con solo_super_admin=true", () => {
    const tree = buildTestTree();
    const filtered = filterCarpetasForZip(tree, staff);

    // dept-secret y serv-restricted excluidos
    const ids = filtered.map((n) => n.id);
    expect(ids).not.toContain("dept-secret");
    expect(ids).not.toContain("serv-restricted");
    // dept-pub y manual-1 presentes
    expect(ids).toContain("dept-pub");
    expect(ids).toContain("manual-1");
  });

  it("Staff NO recibe hijos de departamento restringido (herencia)", () => {
    const tree = buildTestTree();
    const filtered = filterCarpetasForZip(tree, staff);

    // dept-secret excluido → sus hijos también
    const deptSecret = filtered.find((n) => n.id === "dept-secret");
    expect(deptSecret).toBeUndefined();
  });

  it("Admin tiene mismas restricciones que Staff", () => {
    const tree = buildTestTree();
    const filtered = filterCarpetasForZip(tree, admin);

    const ids = filtered.map((n) => n.id);
    expect(ids).not.toContain("dept-secret");
    expect(ids).not.toContain("serv-restricted");
    expect(ids).toContain("dept-pub");
    expect(ids).toContain("manual-1");
  });

  it("Carpetas MANUAL (sin etiqueta) siempre incluidas para Staff", () => {
    const tree = buildTestTree();
    const filtered = filterCarpetasForZip(tree, staff);

    const manual = filtered.find((n) => n.id === "manual-1");
    expect(manual).toBeDefined();
    expect(manual!.archivos).toHaveLength(1);
  });

  it("Subárbol público conserva toda su jerarquía", () => {
    const tree = buildTestTree();
    const filtered = filterCarpetasForZip(tree, staff);

    const deptPub = filtered.find((n) => n.id === "dept-pub");
    expect(deptPub).toBeDefined();
    expect(deptPub!.children).toHaveLength(1);
    expect(deptPub!.children[0].children).toHaveLength(1);
    expect(deptPub!.children[0].children[0].archivos).toHaveLength(1);
  });
});

// ─── Tests de Rutas ZIP ────────────────────────────────────────────────────

describe("buildZipPaths", () => {
  it("genera rutas jerárquicas correctas", () => {
    const tree = buildTestTree();
    const paths = buildZipPaths(tree);

    // Debe incluir carpetas como directorios y archivos con ruta completa
    expect(paths).toContainEqual({
      zipPath: "Fiscal/Declaración IVA/Documentos/factura.pdf",
      archivoId: "f1",
      sizeBytes: 1024,
    });
  });

  it("incluye carpetas vacías como directorios", () => {
    const tree = [node({ id: "empty", nombre: "Carpeta Vacía" })];
    const paths = buildZipPaths(tree);

    expect(paths).toContainEqual({
      zipPath: "Carpeta Vacía/",
      archivoId: null,
      sizeBytes: null,
    });
  });

  it("archivos en raíz de carpeta tienen ruta carpeta/archivo", () => {
    const tree = [
      node({
        id: "root",
        nombre: "MiCarpeta",
        archivos: [{ id: "a1", nombre: "doc.pdf", mime_type: null, size_bytes: 100 }],
      }),
    ];
    const paths = buildZipPaths(tree);

    expect(paths).toContainEqual({
      zipPath: "MiCarpeta/doc.pdf",
      archivoId: "a1",
      sizeBytes: 100,
    });
  });
});
