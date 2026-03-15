// ============================================================================
// lib/modules/entidades/utils/egoGraphFlow.ts — Adaptador React Flow
//
// @role: @Data-Architect
// @spec: FASE 14.03 — Migración a React Flow con clustering
//
// Transforma la salida de buildEgoGraph() → nodos y aristas React Flow,
// incluyendo Parent Nodes (nubes semánticas) para clustering por categoría.
// ============================================================================

import type { GraphNode, GraphEdge } from "./egoGraph";
import type { Node, Edge } from "@xyflow/react";
import dagre from "@dagrejs/dagre";

// ─── Colores por categoría ──────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Societaria:     { bg: "rgba(245,158,11,0.06)",  border: "rgba(245,158,11,0.25)",  text: "#b45309" },
  Laboral:        { bg: "rgba(59,130,246,0.06)",   border: "rgba(59,130,246,0.25)",  text: "#1d4ed8" },
  Familiar:       { bg: "rgba(236,72,153,0.06)",   border: "rgba(236,72,153,0.25)",  text: "#be185d" },
  Comercial:      { bg: "rgba(16,185,129,0.06)",   border: "rgba(16,185,129,0.25)",  text: "#047857" },
  Administrativa: { bg: "rgba(139,92,246,0.06)",   border: "rgba(139,92,246,0.25)",  text: "#6d28d9" },
  Profesional:    { bg: "rgba(6,182,212,0.06)",    border: "rgba(6,182,212,0.25)",   text: "#0e7490" },
};

const DEFAULT_COLORS = { bg: "rgba(113,113,122,0.06)", border: "rgba(113,113,122,0.25)", text: "#52525b" };

export function getCatColors(cat: string) {
  return CATEGORY_COLORS[cat] ?? DEFAULT_COLORS;
}

// ─── Nombres legibles para categorías ───────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  Societaria:     "Estructura Societaria",
  Laboral:        "Equipo Laboral",
  Familiar:       "Vínculos Familiares",
  Comercial:      "Red Comercial",
  Administrativa: "Relaciones Administrativas",
  Profesional:    "Red Profesional",
};

// ─── Tipos de nodo personalizados ───────────────────────────────────────────

export type PersonaNodeData = {
  label: string;
  tipo: string;
  isCenter: boolean;
  clusterGroup: string;
  relationCount: number;
  contactoId: string;
};

export type ClusterNodeData = {
  label: string;
  category: string;
  colors: { bg: string; border: string; text: string };
};

// ─── Dagre auto-layout ──────────────────────────────────────────────────────

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  });

  // Only layout non-group nodes
  for (const node of nodes) {
    if (node.type === "cluster") continue;
    const w = node.type === "empresa" ? 220 : 180;
    const h = node.type === "empresa" ? 80 : 80;
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    if (node.type === "cluster") return node;
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - (pos.width ?? 0) / 2, y: pos.y - (pos.height ?? 0) / 2 },
    };
  });
}

// ─── Función principal: buildReactFlowGraph ─────────────────────────────────

export function buildReactFlowGraph(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[]
): { nodes: Node[]; edges: Edge[] } {
  if (graphNodes.length === 0) return { nodes: [], edges: [] };

  // 1. Group peripheral nodes by category
  const categories = new Map<string, GraphNode[]>();
  const centerNode = graphNodes.find((n) => n.isCenter);

  for (const node of graphNodes) {
    if (node.isCenter) continue;
    const cat = node.clusterGroup;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(node);
  }

  // 2. Build React Flow nodes
  const rfNodes: Node[] = [];

  // Center node (no parent)
  if (centerNode) {
    rfNodes.push({
      id: centerNode.id,
      type: centerNode.tipo === "PERSONA_JURIDICA" ? "empresa" : "persona",
      position: { x: 0, y: 0 },
      data: {
        label: centerNode.displayName,
        tipo: centerNode.tipo,
        isCenter: true,
        clusterGroup: "__center__",
        relationCount: centerNode.relationCount,
        contactoId: centerNode.id,
      } satisfies PersonaNodeData,
    });
  }

  // Cluster (parent) nodes + child nodes
  for (const [category, catNodes] of categories) {
    const clusterId = `cluster__${category}`;
    const colors = getCatColors(category);
    const clusterLabel = CATEGORY_LABELS[category] ?? category;

    // Parent node (group)
    rfNodes.push({
      id: clusterId,
      type: "cluster",
      position: { x: 0, y: 0 },
      data: {
        label: clusterLabel,
        category,
        colors,
      } satisfies ClusterNodeData,
      style: {
        width: Math.max(260, catNodes.length * 200 + 40),
        height: catNodes.length > 2 ? 260 : 180,
      },
    });

    // Child nodes inside the cluster
    for (let i = 0; i < catNodes.length; i++) {
      const node = catNodes[i];
      rfNodes.push({
        id: node.id,
        type: node.tipo === "PERSONA_JURIDICA" ? "empresa" : "persona",
        position: { x: 20 + i * 200, y: 40 },
        parentId: clusterId,
        extent: "parent" as const,
        data: {
          label: node.displayName,
          tipo: node.tipo,
          isCenter: false,
          clusterGroup: category,
          relationCount: node.relationCount,
          contactoId: node.id,
        } satisfies PersonaNodeData,
      });
    }
  }

  // 3. Build React Flow edges
  const rfEdges: Edge[] = graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "relation",
    data: {
      tipoNombre: edge.tipoNombre,
      tipoColor: edge.tipoColor,
      categoria: edge.categoria,
      cargo: edge.cargo,
      porcentaje: edge.porcentaje,
      label: edge.label,
    },
  }));

  // 4. Apply dagre layout (only to non-cluster nodes, then position clusters)
  const layoutedNodes = applyDagreLayout(rfNodes, rfEdges);

  // 5. Reposition cluster nodes to encompass their children
  return { nodes: repositionClusters(layoutedNodes), edges: rfEdges };
}

// ─── Reposition cluster parents to surround children ────────────────────────

function repositionClusters(nodes: Node[]): Node[] {
  const clusterIds = nodes.filter((n) => n.type === "cluster").map((n) => n.id);
  const result = [...nodes];

  for (const clusterId of clusterIds) {
    const children = result.filter((n) => n.parentId === clusterId);
    if (children.length === 0) continue;

    // Find bounding box of children (in absolute coords)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const child of children) {
      const w = child.type === "empresa" ? 220 : 180;
      const h = 80;
      minX = Math.min(minX, child.position.x);
      minY = Math.min(minY, child.position.y);
      maxX = Math.max(maxX, child.position.x + w);
      maxY = Math.max(maxY, child.position.y + h);
    }

    const padding = 30;
    const headerHeight = 36;
    const clusterIdx = result.findIndex((n) => n.id === clusterId);
    if (clusterIdx === -1) continue;

    // Position cluster at top-left of bounding box with padding
    const clusterX = minX - padding;
    const clusterY = minY - padding - headerHeight;
    const clusterW = maxX - minX + padding * 2;
    const clusterH = maxY - minY + padding * 2 + headerHeight;

    result[clusterIdx] = {
      ...result[clusterIdx],
      position: { x: clusterX, y: clusterY },
      style: {
        ...result[clusterIdx].style,
        width: clusterW,
        height: clusterH,
      },
    };

    // Offset children to be relative to cluster
    for (const child of children) {
      const childIdx = result.findIndex((n) => n.id === child.id);
      if (childIdx !== -1) {
        result[childIdx] = {
          ...result[childIdx],
          position: {
            x: child.position.x - clusterX,
            y: child.position.y - clusterY,
          },
        };
      }
    }
  }

  return result;
}
