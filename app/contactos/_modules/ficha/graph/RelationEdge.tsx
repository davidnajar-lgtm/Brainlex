"use client";

// ============================================================================
// RelationEdge.tsx — Arista premium con EdgeLabelRenderer
//
// @role: @Frontend-UX
// @spec: FASE 14.05 — Light Mode Corporativo Enterprise
// ============================================================================

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

type RelationEdgeData = {
  tipoNombre: string;
  tipoColor: string;
  categoria: string;
  cargo: string | null;
  porcentaje: number | null;
  label: string;
};

function RelationEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = data as RelationEdgeData;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // Build detail text (cargo + porcentaje)
  const details: string[] = [];
  if (d.cargo) details.push(d.cargo);
  if (d.porcentaje != null) {
    const pct = d.porcentaje % 1 === 0 ? d.porcentaje.toFixed(0) : String(d.porcentaje);
    details.push(`${pct}%`);
  }
  const detailText = details.join(" · ");

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "#a1a1aa",
          strokeWidth: selected ? 2.5 : 1.5,
          strokeOpacity: selected ? 1 : 0.7,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex flex-col items-center"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <div
            className={[
              "rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-center shadow-sm",
              "transition-all duration-150",
              selected ? "scale-105 shadow-md border-zinc-300" : "",
            ].join(" ")}
          >
            <span className="block text-sm font-extrabold leading-tight text-black">
              {d.tipoNombre}
            </span>
            {detailText && (
              <span className="block text-xs font-semibold text-zinc-800 leading-tight mt-0.5">
                {detailText}
              </span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationEdge = memo(RelationEdgeComponent);
