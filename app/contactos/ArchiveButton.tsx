"use client";

// ============================================================================
// app/contactos/ArchiveButton.tsx — Botón de Archivado con confirmación
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.4 — Soft Delete (QUARANTINE) de Contactos
//
// VETO LEGAL: este componente NUNCA llama a un DELETE físico.
// Delega en archiveContacto() que usa prisma.update → QUARANTINE.
// ============================================================================

import { useTransition } from "react";
import { archiveContacto } from "@/lib/actions/contactos.actions";

export function ArchiveButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      "¿Archivar este contacto?\n\nPassará a estado Cuarentena y dejará de aparecer en el Directorio activo. El historial legal se conserva íntegramente."
    );
    if (!confirmed) return;

    startTransition(async () => {
      await archiveContacto(id);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title="Archivar contacto (soft delete — el historial se conserva)"
      className="text-xs font-medium text-zinc-700 transition-colors hover:text-red-500 disabled:opacity-40"
    >
      {isPending ? "…" : "Archivar"}
    </button>
  );
}
