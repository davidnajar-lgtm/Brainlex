"use client";

// ============================================================================
// EmpresaNode.tsx — Nodo custom React Flow para Persona Jurídica
//
// @role: @Frontend-UX
// @spec: FASE 14.05 — Light Mode Corporativo Enterprise
// ============================================================================

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2 } from "lucide-react";
import type { PersonaNodeData } from "@/lib/modules/entidades/utils/egoGraphFlow";

function EmpresaNodeComponent({ data }: NodeProps) {
  const d = data as PersonaNodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-zinc-300 !border-zinc-400 !w-2 !h-2" />
      <div
        className={[
          "group relative flex items-center gap-3 rounded-xl px-4 py-3 min-w-[200px] max-w-[260px]",
          "bg-white border-2 shadow-md transition-all duration-200",
          "hover:shadow-lg hover:scale-[1.02]",
          d.isCenter
            ? "border-blue-500 ring-2 ring-blue-500/30"
            : "border-blue-600",
        ].join(" ")}
      >
        {/* Logo/Icon */}
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
            d.isCenter
              ? "bg-blue-100 text-blue-700"
              : "bg-blue-50 text-blue-600",
          ].join(" ")}
        >
          <Building2 className="h-5 w-5" />
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
            d.isCenter ? "text-blue-600" : "text-blue-700",
          ].join(" ")}>
            {d.isCenter ? "Contacto actual" : "Persona Jurídica"}
          </span>
        </div>

        {/* Relation count badge */}
        {d.relationCount > 1 && !d.isCenter && (
          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm">
            {d.relationCount}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-300 !border-zinc-400 !w-2 !h-2" />
    </>
  );
}

export const EmpresaNode = memo(EmpresaNodeComponent);
