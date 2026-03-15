"use client";

// ============================================================================
// app/contactos/_modules/ficha/EcosistemaGraphViewer.tsx
//
// @role: @Frontend-UX / @Data-Architect
// @spec: FASE 14.05 — Light Mode Corporativo Enterprise
//
// VETO P3: este componente se carga via next/dynamic({ ssr: false })
// ============================================================================

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { GraphNode, GraphEdge } from "@/lib/modules/entidades/utils/egoGraph";
import { buildReactFlowGraph } from "@/lib/modules/entidades/utils/egoGraphFlow";
import { PersonaNode } from "./graph/PersonaNode";
import { EmpresaNode } from "./graph/EmpresaNode";
import { ClusterNode } from "./graph/ClusterNode";
import { RelationEdge } from "./graph/RelationEdge";

// ─── Node & Edge type registries ────────────────────────────────────────────

const nodeTypes = {
  persona: PersonaNode,
  empresa: EmpresaNode,
  cluster: ClusterNode,
};

const edgeTypes = {
  relation: RelationEdge,
};

// ─── Light Mode Corporate overrides ─────────────────────────────────────────
const LIGHT_OVERRIDES = `
  .react-flow__node { color: #18181b; background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
  .react-flow__node.selected, .react-flow__node:focus, .react-flow__node:focus-visible { box-shadow: none !important; outline: none !important; }
  .react-flow__handle { background: #d4d4d8; border-color: #a1a1aa; }
  .react-flow__edge-path { stroke: #a1a1aa; }
  .react-flow__panel { color: #52525b; }
  .react-flow__controls { background: white; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .react-flow__controls button { background: white; border-color: #e4e4e7; fill: #71717a; }
  .react-flow__controls button:hover { background: #f4f4f5; fill: #3f3f46; }
  .react-flow__minimap { background: white; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .react-flow__background { background: #fafafa; }
  .react-flow__attribution { display: none; }
`;

// ─── Inner component (needs ReactFlowProvider) ─────────────────────────────

function EcosistemaGraphInner({
  nodes: rawNodes,
  edges: rawEdges,
  onNodeClick: onNodeClickProp,
  onCenterClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onCenterClick?: () => void;
}) {
  const { fitView } = useReactFlow();

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = buildReactFlowGraph(rawNodes, rawEdges);
    return { initialNodes: nodes, initialEdges: edges };
  }, [rawNodes, rawEdges]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // fitView after nodes are rendered and dialog has dimensions
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "cluster") return;
      const data = node.data as { isCenter?: boolean; contactoId?: string };
      if (data.isCenter) {
        onCenterClick?.();
      } else if (data.contactoId) {
        onNodeClickProp?.(data.contactoId);
      }
    },
    [onNodeClickProp, onCenterClick]
  );

  return (
    <>
      <style>{LIGHT_OVERRIDES}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.3}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#fafafa" }}
      >
        <Background
          color="#d4d4d8"
          gap={24}
          size={1}
        />
        <Controls
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "cluster") return "transparent";
            const data = node.data as { isCenter?: boolean };
            if (data.isCenter) return "#2563eb";
            return node.type === "empresa" ? "#93c5fd" : "#d4d4d8";
          }}
          maskColor="rgba(255,255,255,0.7)"
          pannable
          zoomable
        />
      </ReactFlow>
    </>
  );
}

// ─── Componente principal (wrapper con Provider) ────────────────────────────

export function EcosistemaGraphViewer(props: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onCenterClick?: () => void;
}) {
  if (props.nodes.length <= 1) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-16">
        <p className="text-sm text-zinc-400">
          Sin relaciones para visualizar. Crea relaciones en la vista de lista.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlowProvider>
        <EcosistemaGraphInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
