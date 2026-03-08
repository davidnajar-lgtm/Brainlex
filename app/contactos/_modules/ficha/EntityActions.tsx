"use client";

// ============================================================================
// app/contactos/_modules/ficha/EntityActions.tsx — Output Layer (Ficha)
//
// Acciones de salida para la ficha individual de un contacto.
// Fase 2: Imprimir (window.print) + Email (mailto:) operativos.
// Fase 3: PDF real desde export.service.ts.
// ============================================================================

import { Printer, Download, Mail } from "lucide-react";
import { useExport } from "@/lib/modules/entidades/hooks/useExport";
import {
  buildMailtoUri,
  type ExportableContact,
} from "@/lib/modules/entidades/services/export.service";

// ─── Props ────────────────────────────────────────────────────────────────────

interface EntityActionsProps {
  contact: ExportableContact;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EntityActions({ contact }: EntityActionsProps) {
  const { exportToPrint, exportToPdf, isExporting } = useExport();

  const mailtoUri = buildMailtoUri(
    contact,
    typeof window !== "undefined" ? window.location.href : undefined
  );

  return (
    <div className="print:hidden flex w-full flex-wrap items-center gap-1.5">
      {/* Imprimir ficha — funcional Fase 2 */}
      <ActionButton
        onClick={exportToPrint}
        title="Imprimir ficha (Ctrl+P)"
        icon={<Printer className="h-3.5 w-3.5" />}
        label="Imprimir"
      />

      {/* Exportar PDF — stub Fase 3 (muted) */}
      <ActionButton
        onClick={() =>
          exportToPdf({ filename: `ficha-${contact.id}`, title: contact.name })
        }
        title="Exportar PDF (disponible en Fase 3)"
        icon={<Download className="h-3.5 w-3.5" />}
        label="PDF"
        disabled={isExporting}
        muted
      />

      {/* Email — mailto: funcional Fase 2 */}
      <a
        href={mailtoUri}
        title={`Enviar ficha de ${contact.name} por email`}
        className={ACTION_BASE}
      >
        <Mail className="h-3.5 w-3.5" />
        Email
      </a>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const ACTION_BASE = [
  "inline-flex items-center gap-1.5 rounded-lg",
  "border border-zinc-700 bg-zinc-800/60",
  "px-3 py-1.5 text-xs font-medium text-zinc-300",
  "transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100",
].join(" ");

const ACTION_MUTED = [
  "inline-flex items-center gap-1.5 rounded-lg",
  "border border-zinc-800 bg-zinc-900/40",
  "px-3 py-1.5 text-xs font-medium text-zinc-500",
  "transition-colors hover:border-zinc-700 hover:text-zinc-400",
  "disabled:cursor-not-allowed disabled:opacity-40",
].join(" ");

// ─── Botón reutilizable ───────────────────────────────────────────────────────

function ActionButton({
  onClick,
  title,
  icon,
  label,
  disabled = false,
  muted = false,
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={muted ? ACTION_MUTED : ACTION_BASE}
    >
      {icon}
      {label}
    </button>
  );
}
