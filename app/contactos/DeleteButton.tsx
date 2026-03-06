"use client";

// ============================================================================
// app/contactos/DeleteButton.tsx — Botón de Borrado Físico con Modal custom
//
// @role: Agente de Frontend (Client Component)
// @spec: Hard Delete — solo para contactos sin historial comercial o legal.
//
// FLUJO:
//   1. Botón "Eliminar" → abre modal (setShowDeleteModal(true)).
//   2. Botón "Sí, eliminar" dentro del modal → ejecutarBorrado().
//   3. deleteContacto() ejecuta $transaction: deleteMany(links) → delete(contacto).
//   4. Si hay expedientes asociados, la action devuelve error y se muestra en el modal.
// ============================================================================

import { useTransition, useState } from "react";
import { deleteContacto } from "@/lib/actions/contactos.actions";

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function ejecutarBorrado() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteContacto(id);
      if (result && !result.ok) {
        setDeleteError(result.error);
      }
      // Si no hay error, deleteContacto hace redirect → modal se desmonta solo
    });
  }

  return (
    <>
      {/* ── Botón disparador ── */}
      <button
        type="button"
        onClick={() => setShowDeleteModal(true)}
        disabled={isPending}
        title="Eliminar contacto permanentemente (solo si no tiene historial)"
        className="text-xs font-medium text-zinc-700 transition-colors hover:text-red-500 disabled:opacity-40"
      >
        {isPending ? "…" : "Eliminar"}
      </button>

      {/* ── Modal de confirmación ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-100">
              ¿Eliminar o Archivar contacto?
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Si el contacto es nuevo y no tiene datos, se eliminará
              permanentemente. Sin embargo, si ya tiene expedientes, documentos
              o facturas asociadas, el sistema lo enviará a la{" "}
              <span className="font-medium text-zinc-300">
                &ldquo;Cuarentena&rdquo; (Archivado)
              </span>{" "}
              por motivos de seguridad legal para no romper el historial.
            </p>

            {/* Error inline si la action rechaza el borrado */}
            {deleteError && (
              <p className="mt-3 rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}
                disabled={isPending}
                className="rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarBorrado}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
