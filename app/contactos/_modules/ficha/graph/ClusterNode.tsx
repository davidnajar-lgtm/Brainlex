"use client";

// ============================================================================
// ClusterNode.tsx — Nodo "nube" semántica (Parent/Group Node)
//
// @role: @Frontend-UX
// @spec: FASE 14.05 — Light Mode Corporativo Enterprise
// ============================================================================

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import type { ClusterNodeData } from "@/lib/modules/entidades/utils/egoGraphFlow";

function ClusterNodeComponent({ data }: NodeProps) {
  const d = data as ClusterNodeData;

  return (
    <div
      className="h-full w-full rounded-2xl border border-dashed"
      style={{
        backgroundColor: d.colors.bg,
        borderColor: d.colors.border,
      }}
    >
      {/* Header label */}
      <div className="px-4 pt-3 pb-1">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: d.colors.text }}
        >
          {d.label}
        </span>
      </div>
    </div>
  );
}

export const ClusterNode = memo(ClusterNodeComponent);
