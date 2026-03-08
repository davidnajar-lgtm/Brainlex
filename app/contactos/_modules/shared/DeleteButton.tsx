"use client";

// ============================================================================
// app/contactos/_modules/shared/DeleteButton.tsx — Botón de Borrado con Agente Legal
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 1.2 — Flujo VETO LEGAL / Interceptor de Borrado
//
// FLUJO DE 3 FASES (ejecutado en el servidor por legalAgent.interceptDelete):
//   FASE 1 — Auditoría:    El Agente Legal comprueba dependencias legales.
//   FASE 2 — BLOQUEO:      Si hay expedientes/facturas/docs → QUARANTINE (403).
//   FASE 3 — PURGA:        Sin dependencias → DELETE físico → redirect.
//
// UX DISEÑO:
//   El usuario siempre puede añadir un motivo (recomendado).
//   Si hay dependencias, ese motivo se usa como razón de cuarentena.
//   La UI muestra el resultado exacto: "Eliminado" o "Archivado en Cuarentena".
// ============================================================================

import { useTransition, useState, useRef } from "react";
import { ShieldAlert, Trash2, Archive, AlertTriangle } from "lucide-react";
import { deleteContacto } from "@/lib/modules/entidades/actions/contactos.actions";

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [open,      setOpen]         = useState(false);
  const [result,    setResult]       = useState<
    | null
    | { type: "error";       message: string }
    | { type: "quarantined"; message: string; expires_at: Date }
  >(null);

  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function openModal() {
    setResult(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setResult(null);
  }

  function handleConfirm() {
    const reason = reasonRef.current?.value.trim() || undefined;
    setResult(null);

    startTransition(async () => {
      const res = await deleteContacto(id, reason);

      if (!res) {
        // undefined → redirect ya ejecutado (PURGE exitoso)
        return;
      }

      if (res.ok === false) {
        setResult({ type: "error", message: res.error });
        return;
      }

      if (res.ok === "quarantined") {
        setResult({
          type:      "quarantined",
          message:   res.message,
          expires_at: res.expires_at,
        });
      }
    });
  }

  return (
    <>
      {/* ── Botón disparador ── */}
      <button
        type="button"
        onClick={openModal}
        disabled={isPending}
        title="Eliminar contacto (pasa por el Agente Legal)"
        className="text-xs font-medium text-zinc-700 transition-colors hover:text-red-500 disabled:opacity-40"
      >
        {isPending ? "…" : "Eliminar"}
      </button>

      {/* ── Modal de Borrado con Agente Legal ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">

            {/* Cabecera */}
            <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <ShieldAlert className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Solicitud de Borrado — Agente Legal
                </h2>
                <p className="text-xs text-zinc-500">
                  El sistema auditará las dependencias legales antes de ejecutar.
                </p>
              </div>
            </div>

            {/* ── Resultado: QUARANTINE (el agente bloqueó y archivó) ── */}
            {result?.type === "quarantined" ? (
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-950/30 p-4">
                  <Archive className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-amber-300">
                      Contacto archivado en Cuarentena
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-500/80">
                      El Agente Legal detectó dependencias legales y bloqueó el
                      borrado físico (HTTP 403). El contacto ha sido enviado
                      automáticamente a CUARENTENA.
                    </p>
                    <p className="mt-2 text-xs text-amber-600">
                      Plazo de conservación legal:{" "}
                      <span className="font-mono font-semibold text-amber-400">
                        {result.expires_at.toLocaleDateString("es-ES", {
                          day:   "2-digit",
                          month: "long",
                          year:  "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                  >
                    Entendido
                  </button>
                </div>
              </div>

            ) : (
              /* ── Formulario de confirmación ── */
              <div className="px-6 py-5 space-y-4">

                {/* Explicación de las dos posibles fases */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Fase 3A — Purga física
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Si el contacto no tiene expedientes, facturas ni documentos
                        asociados, será eliminado permanentemente de la base de datos.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 border-t border-zinc-800 pt-3">
                    <Archive className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Fase 3B — Cuarentena Legal (VETO)
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Si tiene historial comercial o legal, el Agente bloqueará el
                        borrado (403) y lo archivará en CUARENTENA durante 5 años.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Campo de motivo */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Motivo{" "}
                    <span className="normal-case font-normal text-zinc-700">
                      (recomendado — obligatorio si el sistema activa la cuarentena)
                    </span>
                  </label>
                  <textarea
                    ref={reasonRef}
                    rows={3}
                    placeholder="Ej: Contacto duplicado creado por error. Sin actividad comercial."
                    className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors focus:border-zinc-500"
                  />
                </div>

                {/* Error inline */}
                {result?.type === "error" && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-800/40 bg-red-950/30 px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <p className="text-xs text-red-400">{result.message}</p>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isPending}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {isPending ? "El Agente Legal está verificando…" : "Confirmar solicitud"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
