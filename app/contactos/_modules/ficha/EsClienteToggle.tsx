"use client";

import { useState, useTransition } from "react";
import { toggleEsCliente } from "@/lib/modules/entidades/actions/contactos.actions";

export function EsClienteToggle({
  contactoId,
  initialEsCliente,
}: {
  contactoId:       string;
  initialEsCliente: boolean;
}) {
  const [esCliente, setEsCliente]    = useState(initialEsCliente);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleEsCliente(contactoId);
      if (result.ok) setEsCliente(result.es_cliente);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={esCliente ? "Quitar rol de Cliente" : "Marcar como Cliente"}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        "border transition-colors duration-150 disabled:opacity-50",
        esCliente
          ? "border-[var(--badge-cliente-ring)] bg-[var(--badge-cliente-bg)] text-[var(--badge-cliente-text)] hover:opacity-75"
          : "border-zinc-600 bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          esCliente ? "bg-[var(--badge-cliente-text)]" : "bg-zinc-600",
        ].join(" ")}
      />
      Cliente
    </button>
  );
}
