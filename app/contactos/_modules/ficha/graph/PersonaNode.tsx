"use client";

// ============================================================================
// PersonaNode.tsx — Nodo custom React Flow para Persona Física
//
// @role: @Frontend-UX
// @spec: FASE 14.05 — Light Mode Corporativo Enterprise
// ============================================================================

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User } from "lucide-react";
import type { PersonaNodeData } from "@/lib/modules/entidades/utils/egoGraphFlow";

function PersonaNodeComponent({ data }: NodeProps) {
  const d = data as PersonaNodeData;

  const initials = d.label
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-zinc-300 !border-zinc-400 !w-2 !h-2" />
      <div
        className={[
          "group relative flex items-center gap-3 rounded-xl px-4 py-3 min-w-[180px] max-w-[240px]",
          "bg-white border shadow-md transition-all duration-200",
          "hover:shadow-lg hover:scale-[1.02]",
          d.isCenter
            ? "border-blue-500 ring-2 ring-blue-500/30"
            : "border-zinc-300",
        ].join(" ")}
      >
        {/* Avatar */}
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            d.isCenter
              ? "bg-blue-100 text-blue-700"
              : "bg-zinc-100 text-zinc-600",
          ].join(" ")}
        >
          {initials || <User className="h-5 w-5" />}
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0">
          <span
            className="text-base font-extrabold leading-tight truncate text-black"
            title={d.label}
          >
            {d.label}
          </span>
          <span className={[
            "text-xs font-medium mt-0.5",
            d.isCenter ? "text-blue-600" : "text-zinc-700",
          ].join(" ")}>
            {d.isCenter ? "Contacto actual" : "Persona Física"}
          </span>
        </div>

        {/* Relation count badge */}
        {d.relationCount > 1 && !d.isCenter && (
          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-bold text-white shadow-sm">
            {d.relationCount}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-300 !border-zinc-400 !w-2 !h-2" />
    </>
  );
}

export const PersonaNode = memo(PersonaNodeComponent);
