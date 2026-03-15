// ============================================================================
// app/contactos/_modules/shared/ContactIdentityFields.tsx
//
// @role: @Frontend-UX + @Knowledge-Librarian
// @spec: Fase 10.06.1 — Componente DRY para campos de identidad compartidos
//
// Usado por:
//   - QuickCreateModal (modo "create": solo nombre/apellidos/razón social)
//   - IdentityEditModal (modo "edit": + fiscal_id, tipo_sociedad, notas)
//
// Todos los inputs son controlados. El consumidor gestiona el estado.
// ============================================================================
"use client";

import { Search, MapPin } from "lucide-react";
import { inputCls, labelCls } from "@/lib/utils/formHelpers";
import { CompanyAutocompleteInput } from "./CompanyAutocompleteInput";
import type { DetectedAddress } from "./CompanyAutocompleteInput";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tipo = "PERSONA_FISICA" | "PERSONA_JURIDICA";

export type PFValues = {
  nombre: string;
  apellido1: string;
  apellido2: string;
};

export type PJValues = {
  razonSocial: string;
};

export type IdentityFieldErrors = Record<string, string[] | undefined>;

// ─── Google Places callbacks ────────────────────────────────────────────────

type PlacesCallbacks = {
  onNameFill: (name: string) => void;
  onAddressFill: (addr: DetectedAddress) => void;
  onPhoneFill: (phone: string, type: "movil" | "fijo") => void;
  onWebsiteFill: (url: string) => void;
  onFillComplete?: () => void;
};

// ─── PF Fields ──────────────────────────────────────────────────────────────

type PFFieldsProps = {
  values: PFValues;
  onChange: (field: keyof PFValues, value: string) => void;
  errors?: IdentityFieldErrors;
  autoFocus?: boolean;
  /** If true, renders hidden inputs with name attrs for form submission */
  formNames?: boolean;
};

export function PFNameFields({
  values,
  onChange,
  errors,
  autoFocus,
  formNames,
}: PFFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className={labelCls}>Nombre *</label>
        <input
          name={formNames ? "nombre" : undefined}
          type="text"
          value={values.nombre}
          onChange={(e) => onChange("nombre", e.target.value)}
          autoFocus={autoFocus}
          placeholder="Nombre"
          className={inputCls(!!errors?.nombre)}
        />
        {errors?.nombre && (
          <p className="mt-1 text-xs text-red-500">{errors.nombre[0]}</p>
        )}
      </div>
      <div>
        <label className={labelCls}>1er Apellido</label>
        <input
          name={formNames ? "apellido1" : undefined}
          type="text"
          value={values.apellido1}
          onChange={(e) => onChange("apellido1", e.target.value)}
          placeholder="Apellido"
          className={inputCls(!!errors?.apellido1)}
        />
        {errors?.apellido1 && (
          <p className="mt-1 text-xs text-red-500">{errors.apellido1[0]}</p>
        )}
      </div>
      <div>
        <label className={labelCls}>2do Apellido</label>
        <input
          name={formNames ? "apellido2" : undefined}
          type="text"
          value={values.apellido2}
          onChange={(e) => onChange("apellido2", e.target.value)}
          placeholder="Apellido"
          className={inputCls(!!errors?.apellido2)}
        />
        {errors?.apellido2 && (
          <p className="mt-1 text-xs text-red-500">{errors.apellido2[0]}</p>
        )}
      </div>
    </div>
  );
}

// ─── PJ Fields ──────────────────────────────────────────────────────────────

type PJFieldsProps = {
  razonSocial: string;
  onRazonSocialChange: (value: string) => void;
  errors?: IdentityFieldErrors;
  autoFocus?: boolean;
  /** If true, renders hidden input with name attr for form submission */
  formName?: boolean;
  /** Visual variant for Google Places trigger */
  placesVariant?: "icon-inside" | "button-below";
  /** Google Places integration */
  showCompanySearch: boolean;
  onToggleCompanySearch: () => void;
  placesCallbacks: PlacesCallbacks;
};

export function PJRazonSocialField({
  razonSocial,
  onRazonSocialChange,
  errors,
  autoFocus,
  formName,
  placesVariant = "button-below",
  showCompanySearch,
  onToggleCompanySearch,
  placesCallbacks,
}: PJFieldsProps) {
  return (
    <div>
      <label className={labelCls}>Razón Social *</label>

      {placesVariant === "icon-inside" ? (
        /* IdentityEditModal style: search icon inside the input */
        <div className="relative">
          <input
            name={formName ? "razon_social" : undefined}
            type="text"
            value={razonSocial}
            onChange={(e) => onRazonSocialChange(e.target.value)}
            autoFocus={autoFocus}
            placeholder="Ej: CONSTRUCCIONES GARCÍA S.L."
            className={`${inputCls(!!errors?.razon_social)} pr-10`}
          />
          <button
            type="button"
            onClick={onToggleCompanySearch}
            title="Buscar empresa en Google Places"
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-colors ${
              showCompanySearch
                ? "text-orange-400"
                : "text-zinc-600 hover:text-orange-400"
            }`}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      ) : (
        /* QuickCreateModal style: button below the input */
        <>
          <input
            name={formName ? "razon_social" : undefined}
            type="text"
            value={razonSocial}
            onChange={(e) => onRazonSocialChange(e.target.value)}
            autoFocus={autoFocus}
            placeholder="Ej: CONSTRUCCIONES GARCÍA S.L."
            className={inputCls(!!errors?.razon_social)}
          />
          <button
            type="button"
            onClick={onToggleCompanySearch}
            className={`mt-1.5 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              showCompanySearch
                ? "bg-orange-500/15 text-orange-400"
                : "text-zinc-500 hover:bg-zinc-800 hover:text-orange-400"
            }`}
          >
            <MapPin className="h-3 w-3" />
            Buscar en Google (rellena nombre y dirección)
          </button>
        </>
      )}

      {errors?.razon_social && (
        <p className="mt-1 text-xs text-red-500">{errors.razon_social[0]}</p>
      )}

      {showCompanySearch && (
        <div className="mt-2">
          <CompanyAutocompleteInput
            onNameFill={placesCallbacks.onNameFill}
            onAddressFill={placesCallbacks.onAddressFill}
            onPhoneFill={placesCallbacks.onPhoneFill}
            onWebsiteFill={placesCallbacks.onWebsiteFill}
            onClose={onToggleCompanySearch}
            onFillComplete={placesCallbacks.onFillComplete ?? onToggleCompanySearch}
          />
        </div>
      )}
    </div>
  );
}
