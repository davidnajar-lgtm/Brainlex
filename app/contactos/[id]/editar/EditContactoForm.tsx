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
import { CustomPhoneInput } from "@/app/contactos/CustomPhoneInput";
import { SociedadCombobox } from "@/app/contactos/SociedadCombobox";
import { updateContacto } from "@/lib/actions/contactos.actions";
import type {
  UpdateContactoInput,
  ContactoFieldErrors,
} from "@/lib/validations/contacto.schema";
import { Contacto, ContactoTipo, FiscalIdTipo } from "@prisma/client";

// ─── Tipos para el bridge POI ─────────────────────────────────────────────────

/** Datos externos que puede inyectar el buscador Google POI / Places */
export type ExternalPoiData = {
  phone?:    string;   // número de teléfono en cualquier formato
  website?:  string;   // URL del sitio web
  linkedin?: string;   // URL del perfil de LinkedIn
};

/** Sugerencias en espera (campo ya tiene valor manual → no sobrescribir) */
type PoiSuggestion = {
  telefono_movil?: string;
  telefono_fijo?:  string;
  website_url?:    string;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const FISCAL_ID_TIPOS_PF: { value: FiscalIdTipo; label: string }[] = [
  { value: FiscalIdTipo.NIF,            label: "NIF" },
  { value: FiscalIdTipo.DNI,            label: "DNI" },
  { value: FiscalIdTipo.NIE,            label: "NIE" },
  { value: FiscalIdTipo.PASAPORTE,      label: "Pasaporte" },
  { value: FiscalIdTipo.TIE,            label: "TIE" },
  { value: FiscalIdTipo.VAT,            label: "VAT (UE)" },
  { value: FiscalIdTipo.CODIGO_SOPORTE, label: "Código de Soporte" },
  { value: FiscalIdTipo.SIN_REGISTRO,   label: "Sin Registro" },
];

const FISCAL_ID_TIPOS_PJ: { value: FiscalIdTipo; label: string }[] = [
  { value: FiscalIdTipo.NIF,          label: "NIF" },
  { value: FiscalIdTipo.CIF,          label: "CIF" },
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
  const [esCliente, setEsCliente] = useState(contacto.es_cliente ?? false);
  const [notas, setNotas] = useState<string>(contacto.notas ?? "");

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
    const { phone, website, linkedin } = data;

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
      nombre:        (fd.get("nombre")       as string) || undefined,
      apellido1:     (fd.get("apellido1")    as string) || undefined,
      apellido2:     (fd.get("apellido2")    as string) || undefined,
      razon_social:  (fd.get("razon_social") as string) || undefined,
      fiscal_id_tipo: fiscalIdTipo,
      fiscal_id:     fiscalId,
      tipo_sociedad: tipoSociedad || undefined,
      es_cliente:    esCliente,
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
            <input name="nombre" type="text" defaultValue={contacto.nombre ?? ""} placeholder="María" className={fieldErrors.nombre ? inputError : inputNormal} />
          </FieldGroup>
          <FieldGroup label="Primer apellido" error={fieldErrors.apellido1}>
            <input name="apellido1" type="text" defaultValue={contacto.apellido1 ?? ""} placeholder="García" className={fieldErrors.apellido1 ? inputError : inputNormal} />
          </FieldGroup>
          <FieldGroup label="Segundo apellido" error={fieldErrors.apellido2}>
            <input name="apellido2" type="text" defaultValue={contacto.apellido2 ?? ""} placeholder="López" className={fieldErrors.apellido2 ? inputError : inputNormal} />
          </FieldGroup>
        </div>
      ) : (
        <div key={`pj-${resetKey}`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <FieldGroup label="Razón Social" required error={fieldErrors.razon_social}>
              <input name="razon_social" type="text" defaultValue={contacto.razon_social ?? ""} placeholder="Empresa S.L." className={fieldErrors.razon_social ? inputError : inputNormal} />
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
                const v = websiteUrl.trim();
                if (v && !/^https?:\/\//i.test(v)) setWebsiteUrl(`https://${v}`);
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
                const v = linkedinUrl.trim();
                if (v && !/^https?:\/\//i.test(v)) setLinkedinUrl(`https://${v}`);
              }}
              placeholder="https://linkedin.com/in/usuario"
              className={fieldErrors.linkedin_url ? inputError : inputNormal}
            />
          </FieldGroup>

        </div>
      </div>

      {/* ── Rol de Cliente ── */}
      <div className="border-t border-zinc-800 pt-5">
        <button
          type="button"
          role="switch"
          aria-checked={esCliente}
          onClick={() => setEsCliente((v) => !v)}
          className={`group flex w-full items-center gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors ${
            esCliente
              ? "border-orange-500/40 bg-orange-500/5"
              : "border-zinc-800 bg-zinc-800/40 hover:border-zinc-700"
          }`}
        >
          <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${esCliente ? "bg-orange-500" : "bg-zinc-700"}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${esCliente ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${esCliente ? "text-orange-400" : "text-zinc-300"}`}>
              Este contacto es un Cliente
            </p>
            <p className="text-xs text-zinc-600">
              Habilita la facturación y el panel económico en su ficha
            </p>
          </div>
        </button>
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
