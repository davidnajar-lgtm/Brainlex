// ============================================================================
// lib/modules/entidades/utils/egoGraph.ts — Transformador de datos para Grafo
//
// @role: @Data-Architect
// @spec: FASE 14.01 — Grafo Egocéntrico: datos puros, sin React/d3
//
// Transforma RelacionCompleta[] → { nodes, edges } para el renderizado SVG.
// Función pura, testable, sin dependencias de framework.
// ============================================================================

import type { RelacionCompleta } from "@/lib/modules/entidades/repositories/relacion.repository";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export type GraphNode = {
  id: string;
  displayName: string;
  tipo: string; // "PERSONA_FISICA" | "PERSONA_JURIDICA"
  isCenter: boolean;
  clusterGroup: string; // categoría dominante para clustering
  relationCount: number;
  // d3-force poblará estas coordenadas
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  tipoNombre: string;
  tipoColor: string;
  categoria: string;
  cargo: string | null;
  porcentaje: number | null;
  label: string; // texto legible para la arista
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDisplayName(c: { nombre: string | null; apellido1: string | null; razon_social: string | null; tipo: string }): string {
  if (c.tipo === "PERSONA_JURIDICA") return c.razon_social ?? "—";
  return [c.nombre, c.apellido1].filter(Boolean).join(" ") || "—";
}

function buildEdgeLabel(cargo: string | null, porcentaje: number | null, tipoNombre: string): string {
  const parts: string[] = [];
  if (cargo) parts.push(cargo);
  if (porcentaje != null) {
    const pctStr = porcentaje % 1 === 0 ? porcentaje.toFixed(0) : String(porcentaje);
    parts.push(`${pctStr}%`);
  }
  if (parts.length === 0) return tipoNombre; // fallback
  if (cargo && porcentaje != null) return `${cargo} (${pctStr(porcentaje)}%)`;
  return parts.join(" ");
}

function pctStr(p: number): string {
  return p % 1 === 0 ? p.toFixed(0) : String(p);
}

// ─── Función principal ──────────────────────────────────────────────────────

export function buildEgoGraph(
  contactoId: string,
  contactoName: string,
  relaciones: RelacionCompleta[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Mapa de nodos periféricos (deduplicado por ID)
  const peripheralMap = new Map<string, {
    contact: { id: string; nombre: string | null; apellido1: string | null; razon_social: string | null; tipo: string };
    categorias: string[];
    count: number;
  }>();

  const edges: GraphEdge[] = [];

  for (const rel of relaciones) {
    const isOrigin = rel.origen_id === contactoId;
    const other = isOrigin ? rel.destino : rel.origen;
    const otherId = other.id;

    // Acumular nodo periférico
    const existing = peripheralMap.get(otherId);
    if (existing) {
      existing.categorias.push(rel.tipo_relacion.categoria);
      existing.count++;
    } else {
      peripheralMap.set(otherId, {
        contact: other,
        categorias: [rel.tipo_relacion.categoria],
        count: 1,
      });
    }

    // Construir edge
    const cargo = rel.cargo ?? null;
    const porcentaje = rel.porcentaje ?? null;
    edges.push({
      id: rel.id,
      source: isOrigin ? contactoId : otherId,
      target: isOrigin ? otherId : contactoId,
      tipoNombre: rel.tipo_relacion.nombre,
      tipoColor: rel.tipo_relacion.color,
      categoria: rel.tipo_relacion.categoria,
      cargo,
      porcentaje,
      label: buildEdgeLabel(cargo, porcentaje, rel.tipo_relacion.nombre),
    });
  }

  // Nodo central
  const centerNode: GraphNode = {
    id: contactoId,
    displayName: contactoName,
    tipo: "PERSONA_FISICA", // el tipo real se podría pasar como parámetro
    isCenter: true,
    clusterGroup: "__center__",
    relationCount: relaciones.length,
  };

  // Nodos periféricos
  const peripheralNodes: GraphNode[] = [];
  for (const [id, data] of peripheralMap) {
    // Categoría dominante = la más frecuente
    const freq = new Map<string, number>();
    for (const cat of data.categorias) {
      freq.set(cat, (freq.get(cat) ?? 0) + 1);
    }
    let dominant = data.categorias[0];
    let maxCount = 0;
    for (const [cat, count] of freq) {
      if (count > maxCount) {
        dominant = cat;
        maxCount = count;
      }
    }

    peripheralNodes.push({
      id,
      displayName: getDisplayName(data.contact),
      tipo: data.contact.tipo,
      isCenter: false,
      clusterGroup: dominant,
      relationCount: data.count,
    });
  }

  return {
    nodes: [centerNode, ...peripheralNodes],
    edges,
  };
}
