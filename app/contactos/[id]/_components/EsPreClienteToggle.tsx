"use client";

import { useState, useTransition } from "react";
import { toggleEsPrecliente } from "@/lib/actions/contactos.actions";

export function EsPreClienteToggle({
  contactoId,
  initialEsPrecliente,
}: {
  contactoId:          string;
  initialEsPrecliente: boolean;
}) {
  const [esPrecliente, setEsPrecliente] = useState(initialEsPrecliente);
  const [isPending, startTransition]    = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleEsPrecliente(contactoId);
      if (result.ok) setEsPrecliente(result.es_precliente);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={esPrecliente ? "Quitar estado Pre-cliente" : "Marcar como Pre-cliente"}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        "border transition-colors duration-150 disabled:opacity-50",
        esPrecliente
          ? "border-blue-700 bg-blue-950/60 text-blue-400 hover:bg-blue-950"
          : "border-zinc-600 bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          esPrecliente ? "bg-blue-400" : "bg-zinc-600",
        ].join(" ")}
      />
      {esPrecliente ? "Pre-cliente" : "Pre-cliente"}
    </button>
  );
}
