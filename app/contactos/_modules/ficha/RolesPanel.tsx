"use client";

import { useState, useTransition } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
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
  const [editing,       setEditing]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [isPending,     startTransition]  = useTransition();

  const ningúnRol = !esCliente && !esPrecliente && !esFacturadora;

  function handleToggleCliente() {
    setError(null);
    startTransition(async () => {
      const result = await toggleEsCliente(contactoId);
      if (result.ok) {
        setEsCliente(result.es_cliente);
        setEsPrecliente(result.es_precliente);
      }
    });
  }

  function handleTogglePrecliente() {
    setError(null);
    startTransition(async () => {
      const result = await toggleEsPrecliente(contactoId);
      if (result.ok) {
        setEsPrecliente(result.es_precliente);
        setEsCliente(result.es_cliente);
      }
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

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* ── Current status badges (read-only) ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1">
        {esFacturadora && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-[var(--badge-matriz-bg)] text-[var(--badge-matriz-text)] ring-[var(--badge-matriz-ring)]">
            MATRIZ
          </span>
        )}
        {esCliente && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-[var(--badge-cliente-bg)] text-[var(--badge-cliente-text)] ring-[var(--badge-cliente-ring)]">
            CLIENTE
          </span>
        )}
        {esPrecliente && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-[var(--badge-prec-bg)] text-[var(--badge-prec-text)] ring-[var(--badge-prec-ring)]">
            PRE-CLIENTE
          </span>
        )}
        {ningúnRol && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 bg-zinc-700/60 text-zinc-300 ring-zinc-500/50">
            CONTACTO
          </span>
        )}
      </div>

      {/* ── Toggle link ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
      >
        {editing ? (
          <>
            Cerrar selector
            <ChevronUp className="h-2.5 w-2.5" />
          </>
        ) : (
          <>
            Seleccionar status del contacto
            <ChevronDown className="h-2.5 w-2.5" />
          </>
        )}
      </button>

      {/* ── Selector (visible only when editing) ───────────────────────── */}
      {editing && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
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

          {/* Cliente */}
          <button
            onClick={handleToggleCliente}
            disabled={isPending}
            title={esCliente ? "Quitar atributo Cliente" : "Marcar como Cliente"}
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

          {/* Pre-cliente */}
          <button
            onClick={handleTogglePrecliente}
            disabled={isPending}
            title={esPrecliente ? "Quitar atributo Pre-cliente" : "Marcar como Pre-cliente"}
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
      )}

      {/* Error inline */}
      {error && (
        <p className="text-[11px] text-amber-400">{error}</p>
      )}
    </div>
  );
}
