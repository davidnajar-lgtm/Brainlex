// ============================================================================
// app/contactos/[id]/_components/CanalFormModal.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Modal Canal con useActionState + errores por campo
// ============================================================================
"use client";

import { useRef, useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Plus, X } from "lucide-react";
import { crearCanal, editarCanal } from "@/lib/actions/filiacion.actions";

// ─── Tipo para datos de edición ───────────────────────────────────────────────

export type CanalInitialData = {
  id:           string;
  tipo:         string;
  valor:        string;
  etiqueta:     string | null;
  subtipo:      string | null;
  es_principal: boolean;
  es_favorito:  boolean;
};

// ─── Helpers de formateo ──────────────────────────────────────────────────────

function applyTitleCase(e: React.ChangeEvent<HTMLInputElement>) {
  const pos = e.target.selectionStart;
  e.target.value = e.target.value.replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  e.target.setSelectionRange(pos, pos);
}

function applyUpperCase(e: React.ChangeEvent<HTMLInputElement>) {
  const pos = e.target.selectionStart;
  e.target.value = e.target.value.toUpperCase();
  e.target.setSelectionRange(pos, pos);
}

// ─── Placeholder dinámico según tipo de canal ─────────────────────────────────

const CANAL_PLACEHOLDERS: Record<string, string> = {
  TELEFONO:  "+34 600 000 000",
  EMAIL:     "nombre@empresa.com",
  WEB:       "https://www.empresa.com",
  LINKEDIN:  "https://linkedin.com/in/usuario",
  WHATSAPP:  "+34 600 000 000",
  FAX:       "+34 91 000 0000",
  OTRA:      "Valor del canal",
};

// ─── Helpers de estilo ────────────────────────────────────────────────────────

const inputCls = (hasError: boolean) =>
  `w-full rounded-lg border px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 bg-zinc-800 focus:outline-none transition-colors ${
    hasError
      ? "border-red-500/70 focus:border-red-400"
      : "border-zinc-700 focus:border-zinc-500"
  }`;

const labelCls =
  "block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1";

// ─── Componente ───────────────────────────────────────────────────────────────

export function CanalFormModal({
  contactoId,
  initialData,
  onClose,
}: {
  contactoId:   string;
  initialData?: CanalInitialData;
  onClose?:     () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef   = useRef<HTMLFormElement>(null);
  const router    = useRouter();

  const action = initialData
    ? editarCanal.bind(null, initialData.id, contactoId)
    : crearCanal;

  const [state, formAction, isPending] = useActionState(action, null);
  const [showErrors, setShowErrors]    = useState(false);
  const [tipoSel, setTipoSel]          = useState(initialData?.tipo ?? "TELEFONO");
  const [subtipoSel, setSubtipoSel]    = useState(initialData?.subtipo ?? "MOVIL");

  // Modo edición: auto-abrir al montar
  useEffect(() => {
    if (initialData) {
      dialogRef.current?.showModal();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Propagar cierre nativo (ESC / backdrop) al padre
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose?.();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Éxito: cerrar + refrescar RSC
  useEffect(() => {
    if (state?.success === true) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state]);

  function openDialog() {
    setShowErrors(false);
    setTipoSel("TELEFONO");
    setSubtipoSel("MOVIL");
    formRef.current?.reset();
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  const errors  = showErrors && state?.success === false ? state.errors : {};
  const isEdit  = !!initialData;

  return (
    <>
      {/* ── Botón disparador (solo en modo creación) ── */}
      {!isEdit && (
        <button
          type="button"
          onClick={openDialog}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir Canal
        </button>
      )}

      {/* ── Dialog nativo HTML5 ── */}
      <dialog
        ref={dialogRef}
        onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        className="m-auto w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-0 shadow-2xl backdrop:bg-black/70"
      >
        <form
          ref={formRef}
          action={formAction}
          onSubmit={() => setShowErrors(true)}
        >
          <input type="hidden" name="contactoId" value={contactoId} />

          {/* Cabecera dinámica */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-100">
                {isEdit ? "Editar Canal de Comunicación" : "Nuevo Canal de Comunicación"}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Campos */}
          <div className="space-y-4 px-6 py-5">

            {/* Tipo — controla el placeholder del campo Valor */}
            <div>
              <label htmlFor="canal-tipo" className={labelCls}>Tipo *</label>
              <select
                id="canal-tipo"
                name="tipo"
                required
                value={tipoSel}
                onChange={(e) => setTipoSel(e.target.value)}
                className={inputCls(false)}
              >
                <option value="TELEFONO">Teléfono</option>
                <option value="EMAIL">Email</option>
                <option value="WEB">Web</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="FAX">Fax</option>
                <option value="OTRA">Otra</option>
              </select>
            </div>

            {/* Subtipo MOVIL / FIJO — solo para TELEFONO */}
            {tipoSel === "TELEFONO" && (
              <div>
                <label className={labelCls}>Subtipo *</label>
                <div className="flex gap-3">
                  {(["MOVIL", "FIJO"] as const).map((sub) => (
                    <label
                      key={sub}
                      className={[
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        subtipoSel === sub
                          ? "border-orange-500/60 bg-orange-500/10 text-orange-300"
                          : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="subtipo"
                        value={sub}
                        checked={subtipoSel === sub}
                        onChange={() => setSubtipoSel(sub)}
                        className="sr-only"
                      />
                      {sub === "MOVIL" ? "Móvil" : "Fijo"}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Valor — validado condicionalmente por tipo en la server action */}
            <div>
              <label htmlFor="canal-valor" className={labelCls}>Valor *</label>
              <input
                id="canal-valor"
                name="valor"
                type="text"
                required
                defaultValue={initialData?.valor ?? ""}
                placeholder={CANAL_PLACEHOLDERS[tipoSel] ?? "Valor del canal"}
                className={inputCls(!!errors?.valor)}
              />
              {errors?.valor && (
                <p className="mt-1 text-xs text-red-500">{errors.valor[0]}</p>
              )}
            </div>

            {/* Etiqueta — MAYÚSCULAS, opcional */}
            <div>
              <label htmlFor="canal-etiqueta" className={labelCls}>
                Etiqueta{" "}
                <span className="normal-case text-zinc-700">(opcional)</span>
              </label>
              <input
                id="canal-etiqueta"
                name="etiqueta"
                type="text"
                defaultValue={initialData?.etiqueta ?? ""}
                onChange={applyUpperCase}
                placeholder="Ej: MÓVIL PERSONAL, EMAIL FACTURACIÓN"
                className={inputCls(false)}
              />
            </div>

            {/* Favorito (TELEFONO) o principal (otros) */}
            {tipoSel === "TELEFONO" ? (
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  name="es_favorito"
                  type="checkbox"
                  defaultChecked={initialData?.es_favorito ?? false}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-orange-500"
                />
                <span className="text-sm text-zinc-400">Marcar como teléfono favorito</span>
              </label>
            ) : (
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  name="es_principal"
                  type="checkbox"
                  defaultChecked={initialData?.es_principal ?? false}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-orange-500"
                />
                <span className="text-sm text-zinc-400">Marcar como canal principal</span>
              </label>
            )}

          </div>

          {/* Pie */}
          <div className="flex justify-end gap-3 border-t border-zinc-800 px-6 py-4">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
