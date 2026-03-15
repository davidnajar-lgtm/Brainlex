// ============================================================================
// lib/utils/formHelpers.ts — Helpers compartidos para modales de formulario
//
// Funciones de formateo de input y clases de estilo reutilizadas en
// DireccionFormModal y CanalFormModal.
// ============================================================================

import type React from "react";

/** Capitaliza la primera letra de cada palabra mientras el usuario escribe. */
export function applyTitleCase(e: React.ChangeEvent<HTMLInputElement>) {
  const pos = e.target.selectionStart;
  e.target.value = e.target.value.replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  e.target.setSelectionRange(pos, pos);
}

/** Convierte a MAYÚSCULAS mientras el usuario escribe. */
export function applyUpperCase(e: React.ChangeEvent<HTMLInputElement>) {
  const pos = e.target.selectionStart;
  e.target.value = e.target.value.toUpperCase();
  e.target.setSelectionRange(pos, pos);
}

/** Clase CSS para inputs de formulario con estado de error. */
export const inputCls = (hasError: boolean) =>
  `w-full rounded-lg border px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 bg-zinc-800 focus:outline-none transition-colors ${
    hasError
      ? "border-red-500/70 focus:border-red-400"
      : "border-zinc-700 focus:border-zinc-500"
  }`;

/** Clase CSS para labels de formulario. */
export const labelCls =
  "block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1";
