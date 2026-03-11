"use client";

// ============================================================================
// components/ui/ConfirmDialog.tsx — Modal de confirmación integrado
//
// Reemplaza window.confirm() por un modal coherente con el design system.
// Soporta dos variantes:
//   - "danger"  → borrado irreversible (botón rojo)
//   - "warning" → archivado / acción con precaución (botón amber)
//
// @role: @Frontend-UX
// ============================================================================

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ConfirmDialogProps {
  open:          boolean;
  onClose:       () => void;
  onConfirm:     () => void;
  title:         string;
  children:      ReactNode;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      "danger" | "warning";
  icon?:         ReactNode;
  loading?:      boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel  = "Cancelar",
  variant      = "danger",
  icon,
  loading      = false,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus trap: al abrir, foco en botón de confirmar
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const btnColor = variant === "danger"
    ? "bg-red-600 hover:bg-red-500 focus:ring-red-500/40"
    : "bg-amber-600 hover:bg-amber-500 focus:ring-amber-500/40";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-2">
          {icon && (
            <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${
              variant === "danger" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
            }`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-sm font-semibold text-zinc-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 text-xs text-zinc-400 leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 ${btnColor}`}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
