// ============================================================================
// app/contactos/_modules/ficha/CanalCardActions.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Botones Editar / Borrar para tarjeta de Canal
// ============================================================================
"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { eliminarCanal } from "@/lib/modules/entidades/actions/filiacion.actions";

export function CanalCardActions({
  id,
  contactoId,
  onEdit,
}: {
  id:         string;
  contactoId: string;
  onEdit:     () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirm() {
    setShowConfirm(false);
    startTransition(async () => {
      await eliminarCanal(id, contactoId);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        {/* Editar — abre el modal con los datos de este canal pre-cargados */}
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 text-zinc-700 transition-colors hover:bg-zinc-800 hover:text-blue-400"
          title="Editar canal"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {/* Borrar — abre el modal de confirmación */}
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className="rounded p-1 text-zinc-700 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-40"
          title="Borrar canal"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Modal de confirmación ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-100">
              ¿Eliminar canal de comunicación?
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Esta acción no se puede deshacer. Se eliminará permanentemente
              este canal de la base de datos.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
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
