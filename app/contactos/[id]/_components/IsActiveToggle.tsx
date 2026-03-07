"use client";

// ============================================================================
// IsActiveToggle.tsx — Toggle comercial is_active del Contacto
//
// Botón de un solo clic que llama a toggleIsActive().
// is_active es INDEPENDIENTE del ciclo legal QUARANTINE/FORGOTTEN.
// Un contacto inactivo sigue teniendo todos sus datos intactos.
// ============================================================================

import { useState, useTransition } from "react";
import { toggleIsActive } from "@/lib/actions/contactos.actions";

interface IsActiveToggleProps {
  contactoId: string;
  initialIsActive: boolean;
}

export function IsActiveToggle({ contactoId, initialIsActive }: IsActiveToggleProps) {
  const [isActive, setIsActive]  = useState(initialIsActive);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleIsActive(contactoId);
      if (result.ok) setIsActive(result.is_active);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={isActive ? "Marcar como inactivo" : "Reactivar contacto"}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        "border transition-colors duration-150 disabled:opacity-50",
        isActive
          ? "border-orange-700 bg-orange-950/60 text-orange-400 hover:bg-orange-950"
          : "border-zinc-600 bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-orange-400" : "bg-zinc-500",
        ].join(" ")}
      />
      {isActive ? "Activo" : "Inactivo"}
    </button>
  );
}
