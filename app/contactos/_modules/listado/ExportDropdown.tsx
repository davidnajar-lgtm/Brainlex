"use client";

// ============================================================================
// app/contactos/_modules/listado/ExportDropdown.tsx — Export Hub (Listado)
//
// Botón único "Exportar" con menú desplegable. Fase 2: Print + Copy Emails
// operativos. Fase 3: Excel real desde export.service.ts.
//
// GARANTÍA RGPD — Contactos FORGOTTEN:
//   Los contactos con status FORGOTTEN nunca llegan a este componente.
//   El prop `emails` proviene de ContactosClient, que recibe únicamente los
//   contactos cargados por `findAll()` en el RSC padre. `findAll()` filtra
//   estrictamente por `status: ACTIVE` a nivel de base de datos (Prisma where).
//   Por diseño, ningún contacto FORGOTTEN puede aparecer en el listado activo
//   ni ser exportado — la garantía es estructural, no condicional.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  Download,
  ChevronDown,
  Printer,
  FileSpreadsheet,
  ClipboardCopy,
  Check,
} from "lucide-react";
import { copyEmailsToClipboard } from "@/lib/modules/entidades/services/export.service";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportDropdownProps {
  /** Emails de los contactos del listado actualmente filtrado. */
  emails: string[];
  /** Número de registros filtrados (para tooltip). */
  count?: number;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ExportDropdown({ emails, count }: ExportDropdownProps) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function handleCopyEmails() {
    try {
      const n = await copyEmailsToClipboard(emails);
      if (n > 0) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // El navegador puede denegar el permiso — fallo silencioso
    }
    setOpen(false);
  }

  function handlePrint() {
    setOpen(false);
    window.print();
  }

  const validEmails = emails.filter((e) => e.trim().length > 0);

  return (
    <div ref={ref} className="print:hidden relative inline-block">
      {/* Botón principal */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100"
      >
        <Download className="h-3.5 w-3.5" />
        Exportar
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Menú desplegable */}
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-52 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
          <div className="p-1">

            {/* Excel — stub Fase 3 */}
            <DropdownItem
              icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              label="Descargar Excel (.xlsx)"
              description="Disponible en Fase 3"
              onClick={() => setOpen(false)}
              muted
            />

            {/* Imprimir — funcional */}
            <DropdownItem
              icon={<Printer className="h-3.5 w-3.5" />}
              label="Generar Reporte Imprimible"
              description={count !== undefined ? `${count} contacto${count !== 1 ? "s" : ""}` : undefined}
              onClick={handlePrint}
            />

            {/* Copiar Emails — funcional */}
            <DropdownItem
              icon={copied
                ? <Check className="h-3.5 w-3.5 text-green-400" />
                : <ClipboardCopy className="h-3.5 w-3.5" />}
              label={copied ? "¡Copiado!" : "Copiar Emails al Portapapeles"}
              description={
                validEmails.length > 0
                  ? `${validEmails.length} email${validEmails.length !== 1 ? "s" : ""}`
                  : "Sin emails en este filtro"
              }
              onClick={validEmails.length > 0 ? handleCopyEmails : () => setOpen(false)}
              muted={validEmails.length === 0}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item interno ─────────────────────────────────────────────────────────────

function DropdownItem({
  icon,
  label,
  description,
  onClick,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors",
        muted
          ? "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400"
          : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium leading-none">{label}</span>
        {description && (
          <span className="text-[10px] leading-none text-zinc-600">{description}</span>
        )}
      </span>
    </button>
  );
}
