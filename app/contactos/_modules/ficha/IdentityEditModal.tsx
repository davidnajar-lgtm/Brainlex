// ============================================================================
// app/contactos/_modules/ficha/IdentityEditModal.tsx
//
// @role: @Frontend-UX (Client Component)
// @spec: Fase 9.1 — Modal de edición de identidad del contacto
//
// Edita: nombre/razón social, apellidos, tipo_sociedad, fiscal_id, notas.
// PJ: incluye CompanyAutocompleteInput para Google Places.
// Patrón: <dialog> + useActionState (igual que DireccionFormModal).
// ============================================================================
"use client";

import { useRef, useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, AlertTriangle } from "lucide-react";
import { ContactoTipo, FiscalIdTipo } from "@prisma/client";
import { updateIdentity } from "@/lib/modules/entidades/actions/identity.actions";
import { useTenant } from "@/lib/context/TenantContext";
import { inputCls, labelCls } from "@/lib/utils/formHelpers";
import {
  FISCAL_ID_TIPOS_PF,
  FISCAL_ID_TIPOS_PJ,
} from "@/lib/modules/entidades/constants/fiscalIdTypes";
import { SociedadCombobox } from "@/app/contactos/_modules/shared/SociedadCombobox";
import { PFNameFields, PJRazonSocialField } from "@/app/contactos/_modules/shared/ContactIdentityFields";
import type { DetectedAddress } from "@/app/contactos/_modules/shared/CompanyAutocompleteInput";

// ─── Props ───────────────────────────────────────────────────────────────────

export type IdentityInitialData = {
  id:             string;
  tipo:           ContactoTipo;
  nombre:         string | null;
  apellido1:      string | null;
  apellido2:      string | null;
  razon_social:   string | null;
  tipo_sociedad:  string | null;
  fiscal_id_tipo: FiscalIdTipo | null;
  fiscal_id:      string | null;
  notas:          string | null;
};

type Props = {
  contacto:           IdentityInitialData;
  onClose?:           () => void;
  /** Callback when Google Places fills address data — parent can open DireccionFormModal */
  onAddressDetected?: (addr: DetectedAddress) => void;
  /** Callback when Google Places fills phone — parent can open DirectChannelsEditModal */
  onPhoneDetected?:   (phone: string, type: "movil" | "fijo") => void;
  /** Callback when Google Places fills website */
  onWebsiteDetected?: (url: string) => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function IdentityEditModal({
  contacto,
  onClose,
  onAddressDetected,
  onPhoneDetected,
  onWebsiteDetected,
}: Props) {
  const dialogRef       = useRef<HTMLDialogElement>(null);
  const formRef         = useRef<HTMLFormElement>(null);
  const backdropDownRef = useRef(false);
  const fiscalIdRef     = useRef<HTMLInputElement>(null);
  const router          = useRouter();
  const { tenant }      = useTenant();

  const [state, formAction, isPending] = useActionState(updateIdentity, null);
  const [showErrors, setShowErrors] = useState(false);

  // Local state for controlled fields — PF
  const [nombre, setNombre] = useState(contacto.nombre ?? "");
  const [apellido1, setApellido1] = useState(contacto.apellido1 ?? "");
  const [apellido2, setApellido2] = useState(contacto.apellido2 ?? "");

  // Local state for controlled fields — PJ + shared
  const [fiscalIdTipo, setFiscalIdTipo] = useState<FiscalIdTipo>(
    contacto.fiscal_id_tipo ?? FiscalIdTipo.SIN_REGISTRO
  );
  const [fiscalId, setFiscalId] = useState(contacto.fiscal_id ?? "");
  const [tipoSociedad, setTipoSociedad] = useState(contacto.tipo_sociedad ?? "");
  const [razonSocial, setRazonSocial] = useState(contacto.razon_social ?? "");
  const [notas, setNotas] = useState(contacto.notas ?? "");

  // Google Places (PJ only)
  const [showCompanySearch, setShowCompanySearch] = useState(false);

  const isPJ = contacto.tipo === ContactoTipo.PERSONA_JURIDICA;

  // Open dialog on mount
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Propagate native close to parent
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose?.();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Success: close + refresh RSC
  useEffect(() => {
    if (state?.ok === true) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleFiscalIdTipoChange(newTipo: FiscalIdTipo) {
    setFiscalIdTipo(newTipo);
    if (newTipo === FiscalIdTipo.SIN_REGISTRO) setFiscalId("");
  }

  // Google Places callbacks (PJ)
  function handleNameFill(name: string) {
    setRazonSocial(name);
  }

  function handleFillComplete() {
    setShowCompanySearch(false);
    setTimeout(() => fiscalIdRef.current?.focus(), 120);
  }

  const errors = showErrors && state?.ok === false && "fieldErrors" in state
    ? (state.fieldErrors ?? {})
    : {};

  const isNifConflict = state?.ok === false && "conflictType" in state && state.conflictType === "NIF_CONFLICT";

  return (
    <dialog
      ref={dialogRef}
      onMouseDown={(e) => { backdropDownRef.current = e.target === e.currentTarget; }}
      onClick={(e)     => { if (backdropDownRef.current && e.target === e.currentTarget) closeDialog(); }}
      className="m-auto w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-0 shadow-2xl backdrop:bg-black/70"
    >
      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => setShowErrors(true)}
      >
        <input type="hidden" name="contactoId" value={contacto.id} />
        <input type="hidden" name="companyId" value={tenant.id} />
        <input type="hidden" name="tipo" value={contacto.tipo} />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Editar Identidad
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

        {/* Body */}
        <div className="space-y-4 px-6 py-5">

          {/* NIF Conflict warning */}
          {isNifConflict && state.ok === false && "conflictContactoName" in state && (
            <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Conflicto de NIF detectado
              </div>
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-200">
                {state.error}
              </p>
            </div>
          )}

          {/* Global error — only when no field-level errors (otherwise inline errors are shown) */}
          {!isNifConflict && state?.ok === false && state.error && !("fieldErrors" in state && state.fieldErrors) && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 ring-1 ring-red-300 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800/30">
              {state.error}
            </p>
          )}

          {/* Field-level error summary — lists which fields have issues */}
          {!isNifConflict && state?.ok === false && "fieldErrors" in state && state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
            <div className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 ring-1 ring-red-300 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800/30">
              <p className="font-medium">Corrige los siguientes campos:</p>
              <ul className="mt-1 list-inside list-disc">
                {Object.entries(state.fieldErrors).map(([field, msgs]) => (
                  <li key={field}>{(msgs as string[])[0]}</li>
                ))}
              </ul>
            </div>
          )}

          {/* PF Fields — shared DRY component */}
          {!isPJ && (
            <>
              <input type="hidden" name="nombre" value={nombre} />
              <input type="hidden" name="apellido1" value={apellido1} />
              <input type="hidden" name="apellido2" value={apellido2} />
              <PFNameFields
                values={{ nombre, apellido1, apellido2 }}
                onChange={(field, value) => {
                  if (field === "nombre") setNombre(value);
                  else if (field === "apellido1") setApellido1(value);
                  else setApellido2(value);
                }}
                errors={errors}
                autoFocus
              />
            </>
          )}

          {/* PJ Fields — shared DRY component + tipo_sociedad */}
          {isPJ && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input type="hidden" name="razon_social" value={razonSocial} />
                <PJRazonSocialField
                  razonSocial={razonSocial}
                  onRazonSocialChange={setRazonSocial}
                  errors={errors}
                  autoFocus
                  placesVariant="icon-inside"
                  showCompanySearch={showCompanySearch}
                  onToggleCompanySearch={() => setShowCompanySearch((v) => !v)}
                  placesCallbacks={{
                    onNameFill: handleNameFill,
                    onAddressFill: (addr) => onAddressDetected?.(addr),
                    onPhoneFill: (phone, type) => onPhoneDetected?.(phone, type),
                    onWebsiteFill: (url) => onWebsiteDetected?.(url),
                    onFillComplete: handleFillComplete,
                  }}
                />
              </div>
              <div>
                <label className={labelCls}>Tipo Sociedad *</label>
                <input type="hidden" name="tipo_sociedad" value={tipoSociedad} />
                <SociedadCombobox
                  value={tipoSociedad}
                  onChange={setTipoSociedad}
                  error={errors?.tipo_sociedad?.[0]}
                />
                {errors?.tipo_sociedad && <p className="mt-1 text-xs text-red-500">{errors.tipo_sociedad[0]}</p>}
              </div>
            </div>
          )}

          {/* Fiscal ID */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Tipo ID Fiscal</label>
              <input type="hidden" name="fiscal_id_tipo" value={fiscalIdTipo} />
              <select
                value={fiscalIdTipo}
                onChange={(e) => handleFiscalIdTipoChange(e.target.value as FiscalIdTipo)}
                className={inputCls(!!errors?.fiscal_id_tipo)}
              >
                {(isPJ ? FISCAL_ID_TIPOS_PJ : FISCAL_ID_TIPOS_PF).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {errors?.fiscal_id_tipo && <p className="mt-1 text-xs text-red-500">{errors.fiscal_id_tipo[0]}</p>}
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Identificador Fiscal</label>
              <input
                ref={fiscalIdRef}
                name="fiscal_id"
                type="text"
                value={fiscalId}
                onChange={(e) => setFiscalId(e.target.value)}
                disabled={fiscalIdTipo === FiscalIdTipo.SIN_REGISTRO}
                placeholder={fiscalIdTipo === FiscalIdTipo.SIN_REGISTRO ? "No aplica" : "12345678A"}
                className={`${inputCls(!!errors?.fiscal_id)} font-mono tracking-widest disabled:cursor-not-allowed disabled:opacity-40`}
              />
              {errors?.fiscal_id && <p className="mt-1 text-xs text-red-500">{errors.fiscal_id[0]}</p>}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              name="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Observaciones..."
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
            />
          </div>
        </div>

        {/* Footer */}
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
  );
}
