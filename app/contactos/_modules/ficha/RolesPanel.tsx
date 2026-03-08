"use client";

import { useState, useTransition } from "react";
import { Shield } from "lucide-react";
import {
  toggleEsCliente,
  toggleEsPrecliente,
  toggleEsFacturadora,
} from "@/lib/modules/entidades/actions/contactos.actions";

export function RolesPanel({
  contactoId,
  initialEsCliente,
  initialEsPrecliente,
  initialEsFacturadora,
}: {
  contactoId:           string;
  initialEsCliente:     boolean;
  initialEsPrecliente:  boolean;
  initialEsFacturadora: boolean;
}) {
  const [esCliente,     setEsCliente]     = useState(initialEsCliente);
  const [esPrecliente,  setEsPrecliente]  = useState(initialEsPrecliente);
  const [esFacturadora, setEsFacturadora] = useState(initialEsFacturadora);
  const [error,         setError]         = useState<string | null>(null);
  const [isPending,     startTransition]  = useTransition();

  function handleToggleCliente() {
    setError(null);
    startTransition(async () => {
      const result = await toggleEsCliente(contactoId);
      if (result.ok) setEsCliente(result.es_cliente);
    });
  }

  function handleTogglePrecliente() {
    setError(null);
    startTransition(async () => {
      const result = await toggleEsPrecliente(contactoId);
      if (result.ok) setEsPrecliente(result.es_precliente);
    });
  }

  function handleToggleFacturadora() {
    setError(null);
    startTransition(async () => {
      const result = await toggleEsFacturadora(contactoId);
      if (result.ok) {
        setEsFacturadora(result.es_facturadora);
        setEsCliente(result.es_cliente);
        setEsPrecliente(result.es_precliente);
      } else {
        setError(result.error);
      }
    });
  }

  const ningúnRol = !esCliente && !esPrecliente && !esFacturadora;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-center gap-1.5">
        {/* Badge "Contacto Base" — visible solo cuando ningún rol está activo */}
        {ningúnRol && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            Contacto Base
          </span>
        )}

        {/* Matriz / Facturadora */}
        <button
          onClick={handleToggleFacturadora}
          disabled={isPending}
          title={esFacturadora ? "Quitar rol de Matriz" : "Marcar como Entidad Matriz"}
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            "border transition-colors duration-150 disabled:opacity-50",
            esFacturadora
              ? "border-[var(--badge-matriz-ring)] bg-[var(--badge-matriz-bg)] text-[var(--badge-matriz-text)] hover:opacity-75"
              : "border-zinc-600 bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
          ].join(" ")}
        >
          <Shield className={["h-3 w-3", esFacturadora ? "text-[var(--badge-matriz-text)]" : "text-zinc-600"].join(" ")} />
          Matriz
        </button>

        {/* Cliente — independiente de Pre-cliente */}
        <button
          onClick={handleToggleCliente}
          disabled={isPending || esFacturadora}
          title={
            esFacturadora
              ? "Una Entidad Matriz no puede ser Cliente (previene autofacturación)"
              : esCliente
              ? "Quitar atributo Cliente"
              : "Marcar como Cliente"
          }
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            "border transition-colors duration-150 disabled:opacity-50",
            esCliente
              ? "border-[var(--badge-cliente-ring)] bg-[var(--badge-cliente-bg)] text-[var(--badge-cliente-text)] hover:opacity-75"
              : "border-zinc-600 bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
          ].join(" ")}
        >
          <span className={["h-1.5 w-1.5 rounded-full", esCliente ? "bg-[var(--badge-cliente-text)]" : "bg-zinc-600"].join(" ")} />
          Cliente
        </button>

        {/* Pre-cliente — independiente de Cliente */}
        <button
          onClick={handleTogglePrecliente}
          disabled={isPending || esFacturadora}
          title={
            esFacturadora
              ? "Una Entidad Matriz no puede ser Pre-cliente (previene autofacturación)"
              : esPrecliente
              ? "Quitar atributo Pre-cliente"
              : "Marcar como Pre-cliente"
          }
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            "border transition-colors duration-150 disabled:opacity-50",
            esPrecliente
              ? "border-[var(--badge-prec-ring)] bg-[var(--badge-prec-bg)] text-[var(--badge-prec-text)] hover:opacity-75"
              : "border-zinc-600 bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300",
          ].join(" ")}
        >
          <span className={["h-1.5 w-1.5 rounded-full", esPrecliente ? "bg-[var(--badge-prec-text)]" : "bg-zinc-600"].join(" ")} />
          Pre-cliente
        </button>
      </div>

      {/* Error inline (veto de desactivación de Matriz) */}
      {error && (
        <p className="text-center text-[11px] text-amber-400">{error}</p>
      )}
    </div>
  );
}
