// ============================================================================
// app/contactos/_modules/ficha/DireccionFormModal.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Modal Dirección con useActionState + errores por campo
// ============================================================================
"use client";

import { useRef, useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, X, Search, PenLine } from "lucide-react";
import { crearDireccion, editarDireccion } from "@/lib/modules/entidades/actions/filiacion.actions";
import { normalizeAddress } from "@/lib/utils/normalizeAddress";
import { CountrySelectorField } from "./CountrySelectorField";
import { PlacesAutocompleteInput } from "./PlacesAutocompleteInput";

// ─── Tipo para datos de edición ───────────────────────────────────────────────

export type DireccionInitialData = {
  id:            string;
  tipo:          string;
  etiqueta:      string | null;
  calle:         string;
  calle_2:       string | null;
  codigo_postal: string | null;
  ciudad:        string | null;
  provincia:     string | null;
  pais:          string;
  es_principal:  boolean;
};

// ─── Helpers de formateo (aplicados en onChange) ──────────────────────────────

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

export function DireccionFormModal({
  contactoId,
  initialData,
  onClose,
}: {
  contactoId:   string;
  initialData?: DireccionInitialData;
  onClose?:     () => void;
}) {
  const dialogRef         = useRef<HTMLDialogElement>(null);
  const formRef           = useRef<HTMLFormElement>(null);
  const ciudadRef         = useRef<HTMLInputElement>(null);
  const provinciaRef      = useRef<HTMLInputElement>(null);
  const cpRef             = useRef<HTMLInputElement>(null);
  const backdropDownRef   = useRef(false);
  const calleHiddenRef    = useRef<HTMLInputElement>(null);
  const router       = useRouter();

  // Modo edición: action pre-configurada con bind para pasar id + contactoId
  const action = initialData
    ? editarDireccion.bind(null, initialData.id, contactoId)
    : crearDireccion;

  const [state, formAction, isPending] = useActionState(action, null);
  const [showErrors, setShowErrors]       = useState(false);
  const [tipoDireccion, setTipoDireccion] = useState(initialData?.tipo ?? "FISCAL");
  const [pais, setPais]                   = useState(initialData?.pais ?? "ES");

  // Modo de entrada: Places (false) o Manual (true)
  // Edición → manual por defecto (ya tenemos datos); creación → Places
  const [modoManual, setModoManual]   = useState(!!initialData);
  const [tipoVia, setTipoVia]         = useState("");
  const [nombreCalle, setNombreCalle] = useState(initialData?.calle ?? "");
  const [numeroPiso, setNumeroPiso]   = useState("");

  // — Dirty Tracking para campos autocompletables por Google Places —
  // Regla: si el usuario ha escrito manualmente en ciudad/provincia/cp,
  // una nueva selección de Google Places NO sobrescribirá esos campos.
  const [dirtyAddressFields, setDirtyAddressFields] = useState<Set<string>>(new Set());

  function markAddressDirty(field: string) {
    setDirtyAddressFields((prev) => new Set(prev).add(field));
  }

  // Valor combinado que se envía como FormData "calle" en modo manual
  const calleManualValue =
    [tipoVia, nombreCalle].filter(Boolean).join(" ") +
    (numeroPiso.trim() ? `, ${numeroPiso.trim()}` : "");

  // Sincroniza el valor del campo calle oculto (modo manual) al DOM de forma imperativa.
  // Esto garantiza que FormData.get("calle") lea el valor actual aunque React
  // no haya propagado el atributo value del hidden input en el ciclo de render.
  useEffect(() => {
    if (modoManual && calleHiddenRef.current) {
      calleHiddenRef.current.value = calleManualValue;
    }
  }, [modoManual, calleManualValue]);

  // Modo edición: auto-abrir el dialog al montar el componente
  useEffect(() => {
    if (initialData) {
      dialogRef.current?.showModal();
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Propagamos cierre nativo (ESC / backdrop) al padre vía onClose
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
    setTipoDireccion("FISCAL");
    setPais("ES");
    setModoManual(false);
    setTipoVia("");
    setNombreCalle("");
    setNumeroPiso("");
    setDirtyAddressFields(new Set()); // nueva sesión → reset dirty
    formRef.current?.reset();
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    // onClose se dispara via el event listener "close" de arriba
  }

  // Setters individuales — llamados desde PlacesAutocompleteInput al elegir sugerencia.
  // DIRTY PROTECTION: si el campo fue editado manualmente en esta sesión, no se sobrescribe.
  const setCiudad = (v: string) => {
    if (dirtyAddressFields.has("ciudad")) return;
    if (ciudadRef.current) ciudadRef.current.value = normalizeAddress(v);
  };
  const setProvincia = (v: string) => {
    if (dirtyAddressFields.has("provincia")) return;
    if (provinciaRef.current) provinciaRef.current.value = normalizeAddress(v);
  };
  const setCodigoPostal = (v: string) => {
    if (dirtyAddressFields.has("codigo_postal")) return;
    if (cpRef.current) cpRef.current.value = v.toUpperCase();
  };

  const errors      = showErrors && state?.success === false ? state.errors : {};
  const showEtiqueta = tipoDireccion === "WORKPLACE" || tipoDireccion === "OTRO";
  const isEdit       = !!initialData;

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
          Añadir Dirección
        </button>
      )}

      {/* ── Dialog nativo HTML5 ── */}
      <dialog
        ref={dialogRef}
        onMouseDown={(e) => { backdropDownRef.current = e.target === e.currentTarget; }}
        onClick={(e)     => { if (backdropDownRef.current && e.target === e.currentTarget) closeDialog(); }}
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
              <MapPin className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-100">
                {isEdit ? "Editar Dirección" : "Nueva Dirección"}
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

            {/* Tipo */}
            <div>
              <label htmlFor="dir-tipo" className={labelCls}>Tipo *</label>
              <select
                id="dir-tipo"
                name="tipo"
                required
                value={tipoDireccion}
                onChange={(e) => setTipoDireccion(e.target.value)}
                className={inputCls(false)}
              >
                <option value="FISCAL">Fiscal</option>
                <option value="DOMICILIO_SOCIAL">Domicilio Social</option>
                <option value="WORKPLACE">Workplace / Obra</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            {/* Etiqueta personalizada — solo para WORKPLACE y OTRO */}
            {showEtiqueta && (
              <div>
                <label htmlFor="dir-etiqueta" className={labelCls}>Etiqueta Personalizada</label>
                <input
                  id="dir-etiqueta"
                  name="etiqueta"
                  type="text"
                  defaultValue={initialData?.etiqueta ?? ""}
                  onChange={applyUpperCase}
                  placeholder={tipoDireccion === "WORKPLACE" ? "Ej: OBRA M-40" : "Ej: SEGUNDA RESIDENCIA"}
                  className={inputCls(false)}
                />
              </div>
            )}

            {/* Calle — toggle entre Google Places y entrada manual */}
            <div>
              {/* Cabecera del campo con toggle */}
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="dir-calle" className={labelCls}>Calle / Vía *</label>
                <button
                  type="button"
                  onClick={() => setModoManual((m) => !m)}
                  className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 transition-colors hover:text-orange-400"
                >
                  {modoManual ? (
                    <><Search className="h-3 w-3" /> Buscar con Google</>
                  ) : (
                    <><PenLine className="h-3 w-3" /> Entrada manual</>
                  )}
                </button>
              </div>

              {/* Modo Places */}
              {!modoManual && (
                <PlacesAutocompleteInput
                  id="dir-calle"
                  name="calle"
                  required
                  defaultValue={initialData?.calle ?? ""}
                  placeholder="Empieza a escribir para buscar…"
                  className={inputCls(!!errors?.calle)}
                  setCiudad={setCiudad}
                  setCodigoPostal={setCodigoPostal}
                  setProvincia={setProvincia}
                  setPais={setPais}
                />
              )}

              {/* Modo Manual */}
              {modoManual && (
                <div className="space-y-2">
                  {/* Input oculto — valor sincronizado por ref imperativo (useEffect) */}
                  <input type="hidden" ref={calleHiddenRef} name="calle" defaultValue={calleManualValue} />

                  {/* Fila 1: Tipo de vía + Nombre de calle */}
                  <div className="flex gap-2">
                    <select
                      value={tipoVia}
                      onChange={(e) => setTipoVia(e.target.value)}
                      className={`${inputCls(false)} w-36 flex-none`}
                    >
                      <option value="">Tipo</option>
                      <option value="Calle">Calle</option>
                      <option value="Avenida">Avenida</option>
                      <option value="Paseo">Paseo</option>
                      <option value="Plaza">Plaza</option>
                      <option value="Carrer">Carrer</option>
                      <option value="Via">Via</option>
                      <option value="Ronda">Ronda</option>
                      <option value="Travesía">Travesía</option>
                      <option value="Camino">Camino</option>
                      <option value="Urbanización">Urbanización</option>
                      <option value="Polígono">Polígono</option>
                      <option value="Glorieta">Glorieta</option>
                      <option value="Boulevard">Boulevard</option>
                      <option value="Otro">Otro</option>
                    </select>
                    <input
                      type="text"
                      value={nombreCalle}
                      onChange={(e) => setNombreCalle(e.target.value)}
                      onBlur={(e) => setNombreCalle(normalizeAddress(e.target.value))}
                      placeholder="Nombre de la calle"
                      required={modoManual}
                      className={`${inputCls(!!errors?.calle)} flex-1`}
                    />
                  </div>

                  {/* Fila 2: Número / Piso */}
                  <input
                    type="text"
                    value={numeroPiso}
                    onChange={(e) => setNumeroPiso(e.target.value)}
                    placeholder="Número, piso, puerta… (ej: 12, 3º B)"
                    className={inputCls(false)}
                  />
                </div>
              )}

              {errors?.calle && (
                <p className="mt-1 text-xs text-red-500">{errors.calle[0]}</p>
              )}
            </div>

            {/* Dirección Adicional / Complemento */}
            <div>
              <label htmlFor="dir-calle2" className={labelCls}>Dirección Adicional / Complemento</label>
              <input
                id="dir-calle2"
                name="calle_2"
                type="text"
                defaultValue={initialData?.calle_2 ?? ""}
                onChange={applyTitleCase}
                placeholder="Ej: Planta 2, Puerta B o Nave 4"
                className={inputCls(false)}
              />
            </div>

            {/* CP (mayúsculas) + Ciudad (formato Título) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dir-cp" className={labelCls}>
                  Código Postal
                  {dirtyAddressFields.has("codigo_postal") && (
                    <span className="ml-1 font-normal normal-case text-orange-500/60">✏</span>
                  )}
                </label>
                <input
                  ref={cpRef}
                  id="dir-cp"
                  name="codigo_postal"
                  type="text"
                  maxLength={10}
                  defaultValue={initialData?.codigo_postal ?? ""}
                  onChange={(e) => { applyUpperCase(e); markAddressDirty("codigo_postal"); }}
                  placeholder="28001"
                  className={[
                    inputCls(!!errors?.codigo_postal),
                    dirtyAddressFields.has("codigo_postal") ? "border-orange-700/50" : "",
                  ].join(" ")}
                />
                {errors?.codigo_postal && (
                  <p className="mt-1 text-xs text-red-500">{errors.codigo_postal[0]}</p>
                )}
              </div>
              <div>
                <label htmlFor="dir-ciudad" className={labelCls}>
                  Ciudad
                  {dirtyAddressFields.has("ciudad") && (
                    <span className="ml-1 font-normal normal-case text-orange-500/60">✏</span>
                  )}
                </label>
                <input
                  ref={ciudadRef}
                  id="dir-ciudad"
                  name="ciudad"
                  type="text"
                  defaultValue={initialData?.ciudad ?? ""}
                  onChange={(e) => { applyTitleCase(e); markAddressDirty("ciudad"); }}
                  onBlur={(e) => { if (modoManual) e.target.value = normalizeAddress(e.target.value); }}
                  placeholder="Madrid"
                  className={[
                    inputCls(false),
                    dirtyAddressFields.has("ciudad") ? "border-orange-700/50" : "",
                  ].join(" ")}
                />
              </div>
            </div>

            {/* Provincia (formato Título) + País ISO (mayúsculas) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dir-provincia" className={labelCls}>
                  Provincia
                  {dirtyAddressFields.has("provincia") && (
                    <span className="ml-1 font-normal normal-case text-orange-500/60">✏</span>
                  )}
                </label>
                <input
                  ref={provinciaRef}
                  id="dir-provincia"
                  name="provincia"
                  type="text"
                  defaultValue={initialData?.provincia ?? ""}
                  onChange={(e) => { applyTitleCase(e); markAddressDirty("provincia"); }}
                  placeholder="Madrid"
                  className={[
                    inputCls(false),
                    dirtyAddressFields.has("provincia") ? "border-orange-700/50" : "",
                  ].join(" ")}
                />
              </div>
              <div>
                <label className={labelCls}>País</label>
                <CountrySelectorField
                  value={pais}
                  onChange={setPais}
                  hasError={!!errors?.pais}
                />
                {errors?.pais && (
                  <p className="mt-1 text-xs text-red-500">{errors.pais[0]}</p>
                )}
              </div>
            </div>

            {/* Es principal */}
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                name="es_principal"
                type="checkbox"
                defaultChecked={initialData?.es_principal ?? false}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-orange-500"
              />
              <span className="text-sm text-zinc-400">Marcar como dirección principal</span>
            </label>

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
