"use client";

// ============================================================================
// app/contactos/[id]/editar/EditContactoForm.tsx — Formulario de Edición
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.4 / 2.5 — Edición + Validación Zod por campo
//        Canales directos: Email, Móvil, Fijo, Web, LinkedIn
//        Tarea 3: handleExternalDataFill — bridge para Google POI
// ============================================================================

import { useTransition, useState } from "react";
import Link from "next/link";
import { Mail, Smartphone, Phone, Globe, Link2 } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { CustomPhoneInput } from "@/components/ui/CustomPhoneInput";
import { SociedadCombobox } from "@/app/contactos/_modules/shared/SociedadCombobox";
import { updateContacto } from "@/lib/modules/entidades/actions/contactos.actions";
import type {
  UpdateContactoInput,
  ContactoFieldErrors,
} from "@/lib/modules/entidades/validations/contacto.schema";
import { Contacto, ContactoTipo, FiscalIdTipo } from "@prisma/client";

// ─── Tipos para el bridge POI ─────────────────────────────────────────────────

/** Datos externos que puede inyectar el buscador Google POI / Places */
export type ExternalPoiData = {
  phone?:      string;   // número de teléfono en cualquier formato
  website?:    string;   // URL del sitio web
  linkedin?:   string;   // URL del perfil de LinkedIn
  razonSocial?: string;  // nombre comercial / razón social desde Google POI
  nombre?:     string;   // nombre de pila (Persona Física)
};

/** Sugerencias en espera (campo ya tiene valor manual → no sobrescribir) */
type PoiSuggestion = {
  telefono_movil?: string;
  telefono_fijo?:  string;
  website_url?:    string;
};

/** Conflictos de identidad: Google sugiere algo diferente a lo que el usuario escribió */
type IdentityConflict = {
  razon_social?: string;
  nombre?:       string;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const FISCAL_ID_TIPOS_PF: { value: FiscalIdTipo; label: string }[] = [
  { value: FiscalIdTipo.NIF,            label: "NIF" },
  { value: FiscalIdTipo.DNI,            label: "DNI" },
  { value: FiscalIdTipo.NIE,            label: "NIE" },
  { value: FiscalIdTipo.PASAPORTE,      label: "Pasaporte" },
  { value: FiscalIdTipo.TIE,            label: "TIE" },
  { value: FiscalIdTipo.VAT,            label: "VAT (UE)" },
  { value: FiscalIdTipo.K,              label: "NIF K (menor español)" },
  { value: FiscalIdTipo.L,              label: "NIF L (español en extranjero)" },
  { value: FiscalIdTipo.M,              label: "NIF M (extranjero sin NIE)" },
  { value: FiscalIdTipo.CODIGO_SOPORTE, label: "Código de Soporte" },
  { value: FiscalIdTipo.SIN_REGISTRO,   label: "Sin Registro" },
];

const FISCAL_ID_TIPOS_PJ: { value: FiscalIdTipo; label: string }[] = [
  { value: FiscalIdTipo.NIF,          label: "NIF" },
  { value: FiscalIdTipo.VAT,          label: "VAT (UE)" },
  { value: FiscalIdTipo.SIN_REGISTRO, label: "Sin Registro" },
];

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function FieldGroup({
  label,
  required,
  error,
  icon,
  children,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  icon?:     React.ReactNode;
  children:  React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {icon && <span className="text-zinc-600">{icon}</span>}
        {label}
        {required && <span className="ml-0.5 text-orange-500">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

/** Banner de sugerencia POI — aparece cuando el campo ya tiene un valor manual */
function PoiSuggestionBanner({
  value,
  onAccept,
  onDismiss,
}: {
  value:     string;
  onAccept:  () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs">
      <span className="shrink-0 text-orange-400">Sugerencia:</span>
      <span className="flex-1 truncate font-mono text-zinc-300">{value}</span>
      <button
        type="button"
        onClick={onAccept}
        className="shrink-0 rounded px-1.5 py-0.5 text-orange-400 transition-colors hover:bg-orange-500/20"
      >
        Aceptar
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-zinc-600 transition-colors hover:text-zinc-400"
      >
        ✕
      </button>
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors";
const inputNormal = `${inputBase} border-zinc-800 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30`;
const inputError  = `${inputBase} border-red-600/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30`;

const selectBase =
  "w-full rounded-lg border bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors";
const selectNormal = `${selectBase} border-zinc-800 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30`;
const selectError  = `${selectBase} border-red-600/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30`;

// ─── Componente principal ─────────────────────────────────────────────────────

export function EditContactoForm({ contacto }: { contacto: Contacto }) {
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<ContactoTipo>(contacto.tipo);
  const [resetKey, setResetKey] = useState(0);
  const [fiscalIdTipo, setFiscalIdTipo] = useState<FiscalIdTipo>(
    contacto.fiscal_id_tipo ?? FiscalIdTipo.NIF
  );
  const [fiscalId, setFiscalId] = useState(contacto.fiscal_id ?? "");
  const [tipoSociedad, setTipoSociedad] = useState<string>(
    contacto.tipo_sociedad ?? ""
  );
  const [notas, setNotas] = useState<string>(contacto.notas ?? "");

  // — Campos de identidad (controlados para soportar dirty tracking y Smart-Fill) —
  const [nombre,    setNombre]    = useState(contacto.nombre    ?? "");
  const [apellido1, setApellido1] = useState(contacto.apellido1 ?? "");
  const [apellido2, setApellido2] = useState(contacto.apellido2 ?? "");
  const [razonSocial, setRazonSocial] = useState(contacto.razon_social ?? "");

  // — Dirty Tracking: campos que el usuario ha editado manualmente —
  // Regla: un campo "sucio" nunca es sobreescrito por datos externos (Google POI).
  const [dirtyFields,      setDirtyFields]      = useState<Set<string>>(new Set());
  const [identityConflict, setIdentityConflict] = useState<IdentityConflict>({});

  function markDirty(field: string) {
    setDirtyFields((prev) => new Set(prev).add(field));
    // Si había un conflicto de Google para este campo, lo descartamos
    setIdentityConflict((prev) => {
      if (!prev[field as keyof IdentityConflict]) return prev;
      const updated = { ...prev };
      delete updated[field as keyof IdentityConflict];
      return updated;
    });
  }

  function clearIdentityConflict(field: keyof IdentityConflict) {
    setIdentityConflict((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }

  function acceptIdentityConflict(field: keyof IdentityConflict) {
    const val = identityConflict[field];
    if (!val) return;
    if (field === "razon_social") setRazonSocial(val);
    if (field === "nombre")       setNombre(val);
    // Aceptar el dato de Google implica que ya no es "dirty" — el usuario lo eligió
    setDirtyFields((prev) => { const n = new Set(prev); n.delete(field); return n; });
    clearIdentityConflict(field);
  }

  // — Canales de Comunicación Directos —
  const [emailPrincipal, setEmailPrincipal] = useState(contacto.email_principal ?? "");
  const [telefonoMovil,  setTelefonoMovil]  = useState(contacto.telefono_movil  ?? "");
  const [telefonoFijo,   setTelefonoFijo]   = useState(contacto.telefono_fijo   ?? "");
  const [websiteUrl,     setWebsiteUrl]     = useState(contacto.website_url     ?? "");
  const [linkedinUrl,    setLinkedinUrl]    = useState(contacto.linkedin_url    ?? "");
  const [canalPreferido, setCanalPreferido] = useState<"EMAIL" | "MOVIL">(
    (contacto.canal_preferido as "EMAIL" | "MOVIL") ?? "EMAIL"
  );

  // — Estado de sugerencias POI (Smart-Fill) —
  const [poiSuggestion, setPoiSuggestion] = useState<PoiSuggestion | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactoFieldErrors>({});

  // ─── handleExternalDataFill — Bridge Google POI (Tarea 3) ────────────────────
  //
  // Inyecta datos desde un buscador externo de empresas (Google Places POI).
  // Smart-Fill: si el campo ya tiene datos manuales → almacena como sugerencia
  // en lugar de sobrescribir. El usuario acepta o descarta con el banner.

  function handleExternalDataFill(data: ExternalPoiData) {
    const { phone, website, linkedin, razonSocial: googleRazonSocial, nombre: googleNombre } = data;

    // ── Identidad: protegida por Dirty Tracking ──────────────────────────────
    if (googleRazonSocial && tipo === ContactoTipo.PERSONA_JURIDICA) {
      if (dirtyFields.has("razon_social")) {
        // Campo sucio → guardar como conflicto, mostrar banner de sugerencia
        setIdentityConflict((prev) => ({ ...prev, razon_social: googleRazonSocial }));
      } else {
        setRazonSocial(googleRazonSocial);
      }
    }
    if (googleNombre && tipo === ContactoTipo.PERSONA_FISICA) {
      if (dirtyFields.has("nombre")) {
        setIdentityConflict((prev) => ({ ...prev, nombre: googleNombre }));
      } else {
        setNombre(googleNombre);
      }
    }

    if (phone) {
      const normalized = phone.startsWith("+") ? phone : `+${phone}`;
      let type: "mobile" | "fixed" = "mobile"; // default → móvil
      try {
        const parsed   = parsePhoneNumberFromString(normalized);
        const lineType = parsed?.getType();
        if (lineType === "FIXED_LINE" || lineType === "FIXED_LINE_OR_MOBILE") {
          type = "fixed";
        }
      } catch { /* usa default mobile */ }

      if (type === "mobile") {
        if (telefonoMovil) {
          setPoiSuggestion((s) => ({ ...s, telefono_movil: normalized }));
        } else {
          setTelefonoMovil(normalized);
        }
      } else {
        if (telefonoFijo) {
          setPoiSuggestion((s) => ({ ...s, telefono_fijo: normalized }));
        } else {
          setTelefonoFijo(normalized);
        }
      }
    }

    if (website) {
      const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
      if (websiteUrl) {
        setPoiSuggestion((s) => ({ ...s, website_url: url }));
      } else {
        setWebsiteUrl(url);
      }
    }

    if (linkedin) {
      const url = /^https?:\/\//i.test(linkedin) ? linkedin : `https://${linkedin}`;
      if (!linkedinUrl) setLinkedinUrl(url);
    }
  }

  // Exponer handleExternalDataFill a componentes padres vía data attribute (futuro: useImperativeHandle)
  void handleExternalDataFill; // marca como usado — se conectará en la siguiente fase

  function dismissSuggestion(field: keyof PoiSuggestion) {
    setPoiSuggestion((s) => {
      if (!s) return null;
      const updated = { ...s };
      delete updated[field];
      return Object.keys(updated).length ? updated : null;
    });
  }

  function acceptSuggestion(field: keyof PoiSuggestion) {
    const val = poiSuggestion?.[field];
    if (!val) return;
    if (field === "telefono_movil") setTelefonoMovil(val);
    if (field === "telefono_fijo")  setTelefonoFijo(val);
    if (field === "website_url")    setWebsiteUrl(val);
    dismissSuggestion(field);
  }

  // ─── Handlers de tipo y fiscal ID ────────────────────────────────────────────

  function handleTipoChange(newTipo: ContactoTipo) {
    setTipo(newTipo);
    setFiscalIdTipo(FiscalIdTipo.NIF);
    setFiscalId("");
    setTipoSociedad("");
    setResetKey((k) => k + 1);
    setFieldErrors({});
    // Limpiar campos de identidad y dirty state al cambiar de tipo
    setNombre("");
    setApellido1("");
    setApellido2("");
    setRazonSocial("");
    setDirtyFields(new Set());
    setIdentityConflict({});
  }

  function handleFiscalIdTipoChange(newTipo: FiscalIdTipo) {
    setFiscalIdTipo(newTipo);
    if (newTipo === FiscalIdTipo.SIN_REGISTRO) setFiscalId("");
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);

    const input: UpdateContactoInput = {
      tipo,
      // Leer desde estado React (fuente de verdad para campos controlados)
      // Garantiza que los valores manuales prevalezcan sobre cualquier caché de API
      nombre:        nombre.trim()      || undefined,
      apellido1:     apellido1.trim()   || undefined,
      apellido2:     apellido2.trim()   || undefined,
      razon_social:  razonSocial.trim() || undefined,
      fiscal_id_tipo: fiscalIdTipo,
      fiscal_id:     fiscalId,
      tipo_sociedad: tipoSociedad || undefined,
      notas:         notas || undefined,
      email_principal: emailPrincipal || undefined,
      telefono_movil:  telefonoMovil  || undefined,
      telefono_fijo:   telefonoFijo   || undefined,
      website_url:     websiteUrl     || undefined,
      linkedin_url:    linkedinUrl    || undefined,
      canal_preferido: canalPreferido,
    };

    startTransition(async () => {
      const result = await updateContacto(contacto.id, input);
      if (result && !result.ok) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
    >
      {/* Banner de error global */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Tipo ── */}
      <FieldGroup label="Tipo de Contacto" required>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: ContactoTipo.PERSONA_FISICA,   label: "Persona Física" },
            { value: ContactoTipo.PERSONA_JURIDICA, label: "Persona Jurídica" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTipoChange(opt.value)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                tipo === opt.value
                  ? "border-orange-500/50 bg-orange-500/10 text-orange-400"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      {/* ── Campos según tipo ── */}
      {tipo === ContactoTipo.PERSONA_FISICA ? (
        <div key={`pf-${resetKey}`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldGroup label="Nombre" required error={fieldErrors.nombre}>
            {identityConflict.nombre && (
              <PoiSuggestionBanner
                value={identityConflict.nombre}
                onAccept={() => acceptIdentityConflict("nombre")}
                onDismiss={() => clearIdentityConflict("nombre")}
              />
            )}
            <input
              name="nombre"
              type="text"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); markDirty("nombre"); }}
              placeholder="María"
              className={[
                fieldErrors.nombre ? inputError : inputNormal,
                dirtyFields.has("nombre") ? "ring-1 ring-orange-500/20 border-orange-700/50" : "",
              ].join(" ")}
            />
          </FieldGroup>
          <FieldGroup label="Primer apellido" error={fieldErrors.apellido1}>
            <input
              name="apellido1"
              type="text"
              value={apellido1}
              onChange={(e) => { setApellido1(e.target.value); markDirty("apellido1"); }}
              placeholder="García"
              className={fieldErrors.apellido1 ? inputError : inputNormal}
            />
          </FieldGroup>
          <FieldGroup label="Segundo apellido" error={fieldErrors.apellido2}>
            <input
              name="apellido2"
              type="text"
              value={apellido2}
              onChange={(e) => { setApellido2(e.target.value); markDirty("apellido2"); }}
              placeholder="López"
              className={fieldErrors.apellido2 ? inputError : inputNormal}
            />
          </FieldGroup>
        </div>
      ) : (
        <div key={`pj-${resetKey}`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <FieldGroup label="Razón Social" required error={fieldErrors.razon_social}>
              {identityConflict.razon_social && (
                <PoiSuggestionBanner
                  value={identityConflict.razon_social}
                  onAccept={() => acceptIdentityConflict("razon_social")}
                  onDismiss={() => clearIdentityConflict("razon_social")}
                />
              )}
              <input
                name="razon_social"
                type="text"
                value={razonSocial}
                onChange={(e) => { setRazonSocial(e.target.value); markDirty("razon_social"); }}
                placeholder="Empresa S.L."
                className={[
                  fieldErrors.razon_social ? inputError : inputNormal,
                  dirtyFields.has("razon_social") ? "ring-1 ring-orange-500/20 border-orange-700/50" : "",
                ].join(" ")}
              />
              {dirtyFields.has("razon_social") && (
                <p className="mt-1 text-[10px] text-orange-500/70">✏ Dato manual — prevalece sobre sugerencias externas</p>
              )}
            </FieldGroup>
          </div>
          <FieldGroup label="Tipo de Sociedad" required error={fieldErrors.tipo_sociedad}>
            <SociedadCombobox value={tipoSociedad} onChange={setTipoSociedad} error={fieldErrors.tipo_sociedad} />
          </FieldGroup>
        </div>
      )}

      {/* ── Identificación Fiscal ── */}
      <div key={`fiscal-${resetKey}`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldGroup label="Tipo de ID Fiscal" required error={fieldErrors.fiscal_id_tipo}>
          <select
            name="fiscal_id_tipo"
            value={fiscalIdTipo}
            onChange={(e) => handleFiscalIdTipoChange(e.target.value as FiscalIdTipo)}
            className={fieldErrors.fiscal_id_tipo ? selectError : selectNormal}
          >
            {(tipo === ContactoTipo.PERSONA_FISICA ? FISCAL_ID_TIPOS_PF : FISCAL_ID_TIPOS_PJ).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </FieldGroup>
        <div className="sm:col-span-2">
          <FieldGroup label="Número de Identificación" required error={fieldErrors.fiscal_id}>
            <input
              name="fiscal_id"
              type="text"
              value={fiscalId}
              onChange={(e) => setFiscalId(e.target.value)}
              disabled={fiscalIdTipo === FiscalIdTipo.SIN_REGISTRO}
              placeholder={fiscalIdTipo === FiscalIdTipo.SIN_REGISTRO ? "No aplica" : "12345678A"}
              className={`${fieldErrors.fiscal_id ? inputError : inputNormal} font-mono tracking-widest disabled:cursor-not-allowed disabled:opacity-40`}
            />
          </FieldGroup>
        </div>
      </div>

      {/* ── Canales de Comunicación Directos ── */}
      <div className="border-t border-zinc-800 pt-5">

        {/* Cabecera con toggle de canal preferido */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Canales de Comunicación
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-600">Canal preferido:</span>
            <div className="flex overflow-hidden rounded-md border border-zinc-700">
              {(["EMAIL", "MOVIL"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanalPreferido(c)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    canalPreferido === c
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {c === "EMAIL" ? "Email" : "Móvil"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Email Principal */}
          <FieldGroup
            label="Email Principal"
            icon={<Mail className="h-3.5 w-3.5" />}
            error={fieldErrors.email_principal}
          >
            <input
              name="email_principal"
              type="email"
              value={emailPrincipal}
              onChange={(e) => setEmailPrincipal(e.target.value)}
              placeholder="contacto@empresa.es"
              className={fieldErrors.email_principal ? inputError : inputNormal}
            />
          </FieldGroup>

          {/* Teléfono Móvil */}
          <FieldGroup
            label="Teléfono Móvil"
            icon={<Smartphone className="h-3.5 w-3.5" />}
            error={fieldErrors.telefono_movil}
          >
            {poiSuggestion?.telefono_movil && (
              <PoiSuggestionBanner
                value={poiSuggestion.telefono_movil}
                onAccept={() => acceptSuggestion("telefono_movil")}
                onDismiss={() => dismissSuggestion("telefono_movil")}
              />
            )}
            <CustomPhoneInput
              value={telefonoMovil}
              onChange={setTelefonoMovil}
              error={fieldErrors.telefono_movil}
            />
          </FieldGroup>

          {/* Teléfono Fijo */}
          <FieldGroup
            label="Teléfono Fijo"
            icon={<Phone className="h-3.5 w-3.5" />}
            error={fieldErrors.telefono_fijo}
          >
            {poiSuggestion?.telefono_fijo && (
              <PoiSuggestionBanner
                value={poiSuggestion.telefono_fijo}
                onAccept={() => acceptSuggestion("telefono_fijo")}
                onDismiss={() => dismissSuggestion("telefono_fijo")}
              />
            )}
            <CustomPhoneInput
              value={telefonoFijo}
              onChange={setTelefonoFijo}
              error={fieldErrors.telefono_fijo}
            />
          </FieldGroup>

          {/* Sitio Web */}
          <FieldGroup
            label="Sitio Web"
            icon={<Globe className="h-3.5 w-3.5" />}
            error={fieldErrors.website_url}
          >
            {poiSuggestion?.website_url && (
              <PoiSuggestionBanner
                value={poiSuggestion.website_url}
                onAccept={() => acceptSuggestion("website_url")}
                onDismiss={() => dismissSuggestion("website_url")}
              />
            )}
            <input
              name="website_url"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onBlur={() => {
                const v = websiteUrl.trim().toLowerCase();
                if (v && !/^https?:\/\//i.test(v)) setWebsiteUrl(`https://${v}`);
                else if (v) setWebsiteUrl(v);
              }}
              placeholder="https://www.empresa.com"
              className={fieldErrors.website_url ? inputError : inputNormal}
            />
          </FieldGroup>

          {/* LinkedIn */}
          <FieldGroup
            label="LinkedIn"
            icon={<Link2 className="h-3.5 w-3.5" />}
            error={fieldErrors.linkedin_url}
          >
            <input
              name="linkedin_url"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              onBlur={() => {
                const v = linkedinUrl.trim().toLowerCase();
                if (v && !/^https?:\/\//i.test(v)) setLinkedinUrl(`https://${v}`);
                else if (v) setLinkedinUrl(v);
              }}
              placeholder="https://linkedin.com/in/usuario"
              className={fieldErrors.linkedin_url ? inputError : inputNormal}
            />
          </FieldGroup>

        </div>
      </div>

      {/* ── Notas ── */}
      <div className="border-t border-zinc-800 pt-5">
        <FieldGroup label="Notas / Observaciones" error={fieldErrors.notas}>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={4}
            placeholder="Observaciones, horario de contacto, recomendaciones..."
            className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
          />
        </FieldGroup>
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-5">
        <Link href="/contactos" className="text-sm text-zinc-500 transition-colors hover:text-zinc-300">
          ← Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600 active:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Guardando…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </form>
  );
}
