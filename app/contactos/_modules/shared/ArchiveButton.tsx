"use client";

// ============================================================================
// app/contactos/_modules/shared/ArchiveButton.tsx — Cuarentena Explícita con Agente Legal
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.4 — Soft Delete (QUARANTINE) de Contactos
//
// VETO LEGAL:
//   Este componente NUNCA llama a un DELETE físico.
//   Delega en archiveContacto() → legalAgent.quarantine() → QUARANTINE.
//   El motivo (quarantine_reason) es OBLIGATORIO por el Agente Legal.
//   El AuditLog se escribe en el servidor antes de mutar el estado.
// ============================================================================

import { useTransition, useState, useRef } from "react";
import { Archive, ShieldCheck, AlertTriangle } from "lucide-react";
import { archiveContacto } from "@/lib/modules/entidades/actions/contactos.actions";

export function ArchiveButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [open,   setOpen]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [done,   setDone]   = useState<{ expires_at: Date } | null>(null);

  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function openModal() {
    setError(null);
    setDone(null);
    setOpen(true);
    // Focus en el textarea tras el siguiente frame
    setTimeout(() => reasonRef.current?.focus(), 50);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
    setDone(null);
  }

  function handleConfirm() {
    const reason = reasonRef.current?.value.trim() ?? "";

    if (reason.length < 5) {
      setError("El motivo es obligatorio (mínimo 5 caracteres).");
      reasonRef.current?.focus();
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await archiveContacto(id, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({ expires_at: result.expires_at });
    });
  }

  return (
    <>
      {/* ── Botón disparador ── */}
      <button
        type="button"
        onClick={openModal}
        disabled={isPending}
        title="Archivar contacto en Cuarentena (VETO LEGAL — el historial se conserva)"
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-40"
      >
        <Archive className="h-4 w-4" />
        {isPending ? "Archivando…" : "Archivar contacto"}
      </button>

      {/* ── Modal de Cuarentena ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">

            {/* Cabecera */}
            <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <Archive className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Enviar a Cuarentena
                </h2>
                <p className="text-xs text-zinc-500">
                  El contacto dejará de aparecer en el Directorio activo.
                </p>
              </div>
            </div>

            {/* ── Resultado: éxito ── */}
            {done ? (
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-800/30 bg-emerald-950/20 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">
                      Contacto archivado correctamente
                    </p>
                    <p className="mt-1 text-xs text-emerald-600">
                      El historial legal se conserva íntegramente. El Agente Legal
                      ha registrado esta acción en el Audit Log inmutable.
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Plazo de conservación:{" "}
                      <span className="font-mono text-zinc-300">
                        {done.expires_at.toLocaleDateString("es-ES", {
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
                    Cerrar
                  </button>
                </div>
              </div>

            ) : (
              /* ── Formulario de motivo ── */
              <div className="px-6 py-5 space-y-4">

                <p className="text-sm text-zinc-400 leading-relaxed">
                  El contacto pasará a estado{" "}
                  <span className="font-semibold text-amber-400">CUARENTENA</span>{" "}
                  y quedará retenido legalmente durante{" "}
                  <span className="font-semibold text-zinc-300">5 años</span>{" "}
                  conforme al art. 70 Ley 58/2003 GILF.
                </p>

                {/* Campo obligatorio */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Motivo de la cuarentena{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    ref={reasonRef}
                    rows={3}
                    placeholder="Ej: Baja voluntaria del cliente. Sin actividad desde 2025-01. Historial conservado para obligaciones fiscales."
                    className={`w-full resize-none rounded-lg border bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors ${
                      error
                        ? "border-red-600/60 focus:border-red-500"
                        : "border-zinc-700 focus:border-amber-500/60"
                    }`}
                  />
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Este motivo quedará registrado en el Audit Log inmutable
                    por el Agente Legal para trazabilidad CISO.
                  </p>
                </div>

                {/* Error inline */}
                {error && (
                  <div
                    className="flex items-start gap-2 rounded-lg border px-3 py-2.5"
                    style={{
                      backgroundColor: "var(--alert-error-bg)",
                      borderColor:     "var(--alert-error-border)",
                    }}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--alert-error-icon)" }} />
                    <p className="text-xs" style={{ color: "var(--alert-error-text)" }}>{error}</p>
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
                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    {isPending ? "Archivando…" : "Enviar a Cuarentena"}
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
