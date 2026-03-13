"use client";

// ============================================================================
// app/contactos/nuevo/page.tsx — Formulario de Alta de Contacto
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.3 / 2.5 / Set-3
//        · Toma Rápida con Google Places Autocomplete (PJ mode)
//        · Magic Fill: name, address, phone (MOBILE/FIXED), website
//        · Dirección incompleta → warning card; CIF recibe focus post-fill
//        · Banner "Datos autocompletados con éxito" con auto-dismiss (4 s)
// ============================================================================

import { useTransition, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Mail, Smartphone, Phone, Globe, Link2, MapPin, X, CheckCircle2, Search, RotateCcw, AlertTriangle } from "lucide-react";
import { CustomPhoneInput } from "@/components/ui/CustomPhoneInput";
import { SociedadCombobox } from "@/app/contactos/_modules/shared/SociedadCombobox";
import { CompanyAutocompleteInput } from "@/app/contactos/_modules/shared/CompanyAutocompleteInput";
import type { DetectedAddress } from "@/app/contactos/_modules/shared/CompanyAutocompleteInput";
import { createContacto, resurrectionRestoreContacto, vincularContactoAMatriz } from "@/lib/modules/entidades/actions/contactos.actions";
import type { InlineAddressData } from "@/lib/modules/entidades/actions/contactos.actions";
import { useTenant } from "@/lib/context/TenantContext";
import type {
  CreateContactoInput,
  ContactoFieldErrors,
} from "@/lib/modules/entidades/validations/contacto.schema";
import { ContactoTipo, FiscalIdTipo } from "@prisma/client";

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

const inputBase =
  "w-full rounded-lg border bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors";
const inputNormal = `${inputBase} border-zinc-800 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30`;
const inputError  = `${inputBase} border-red-600/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30`;

const selectBase =
  "w-full rounded-lg border bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors";
const selectNormal = `${selectBase} border-zinc-800 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30`;
const selectError  = `${selectBase} border-red-600/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30`;

// ─── Página ───────────────────────────────────────────────────────────────────

export default function NuevoContactoPage() {
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<ContactoTipo>(ContactoTipo.PERSONA_FISICA);
  const [resetKey, setResetKey] = useState(0);
  const [fiscalIdTipo, setFiscalIdTipo] = useState<FiscalIdTipo>(FiscalIdTipo.NIF);
  const [fiscalId, setFiscalId] = useState("");
  const [tipoSociedad, setTipoSociedad] = useState<string>("");
  const [esCliente, setEsCliente] = useState(false);
  const [notas, setNotas] = useState<string>("");

  // — Razón Social controlada (necesario para Google Places fill) —
  const [razonSocial, setRazonSocial] = useState("");

  // — Google Places Autocomplete (solo modo PJ) —
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [detectedAddress, setDetectedAddress]     = useState<DetectedAddress | null>(null);
  const [fillSuccess, setFillSuccess]             = useState<string[]>([]);

  // — Foco en CIF tras autocompletado —
  const fiscalIdRef = useRef<HTMLInputElement>(null);

  // — Auto-dismiss del banner de éxito tras 4 s —
  useEffect(() => {
    if (fillSuccess.length === 0) return;
    const timer = setTimeout(() => setFillSuccess([]), 4000);
    return () => clearTimeout(timer);
  }, [fillSuccess]);

  // — Canales de Comunicación Directos —
  const [emailPrincipal, setEmailPrincipal] = useState("");
  const [telefonoMovil,  setTelefonoMovil]  = useState("");
  const [telefonoFijo,   setTelefonoFijo]   = useState("");
  const [websiteUrl,     setWebsiteUrl]     = useState("");
  const [linkedinUrl,    setLinkedinUrl]    = useState("");
  const [canalPreferido, setCanalPreferido] = useState<"EMAIL" | "MOVIL">("EMAIL");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactoFieldErrors>({});

  // — Tenant activo —
  const { tenant } = useTenant();

  // — Resurrección: NIF detectado en QUARANTINE —
  type ResurrectionConflict = {
    contactoId: string;
    contactoName: string;
    pendingInput: CreateContactoInput;
    pendingAddress?: InlineAddressData;
  };
  const [resurrectionConflict, setResurrectionConflict] =
    useState<ResurrectionConflict | null>(null);

  // — Vínculo inter-matriz: NIF detectado en OTRA matriz —
  type CrossMatrixConflict = {
    contactoId: string;
    contactoName: string;
    message: string;
  };
  const [crossMatrixConflict, setCrossMatrixConflict] =
    useState<CrossMatrixConflict | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTipoChange(newTipo: ContactoTipo) {
    setTipo(newTipo);
    setFiscalIdTipo(FiscalIdTipo.NIF);
    setFiscalId("");
    setTipoSociedad("");
    setRazonSocial("");
    setShowCompanySearch(false);
    setDetectedAddress(null);
    setFillSuccess([]);
    setResetKey((k) => k + 1);
    setFieldErrors({});
  }

  function handleFiscalIdTipoChange(newTipo: FiscalIdTipo) {
    setFiscalIdTipo(newTipo);
    if (newTipo === FiscalIdTipo.SIN_REGISTRO) setFiscalId("");
  }

  /** Callback de CompanyAutocompleteInput — todos los campos llenados */
  function handleFillComplete(fields: string[]) {
    setFillSuccess(fields);
    setShowCompanySearch(false);
    // Foco en CIF para que el usuario lo complete de inmediato
    setTimeout(() => fiscalIdRef.current?.focus(), 120);
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);

    const input: CreateContactoInput = {
      tipo,
      nombre:        (fd.get("nombre")       as string) || undefined,
      apellido1:     (fd.get("apellido1")    as string) || undefined,
      apellido2:     (fd.get("apellido2")    as string) || undefined,
      razon_social:  razonSocial || undefined,
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

    // Convierte DetectedAddress → InlineAddressData para la action.
    // BUG FIX: la condición anterior solo creaba la Direccion si había calle.
    // Empresas sin `route` (centros comerciales, polígonos…) tenían ciudad y CP
    // pero calle vacía → addressPayload quedaba undefined → la Direccion nunca
    // se persistía aunque el card de dirección sí apareciera en el formulario.
    // Ahora basta con que haya cualquier dato de dirección útil.
    const hasAddressData =
      detectedAddress &&
      (detectedAddress.calle || detectedAddress.ciudad || detectedAddress.codigo_postal);

    const addressPayload: InlineAddressData | undefined = hasAddressData
      ? {
          calle:         detectedAddress.calle         || "",
          ciudad:        detectedAddress.ciudad        || undefined,
          provincia:     detectedAddress.provincia     || undefined,
          codigo_postal: detectedAddress.codigo_postal || undefined,
          pais:          detectedAddress.pais          || undefined,
        }
      : undefined;

    startTransition(async () => {
      const result = await createContacto(input, addressPayload, tenant.id);
      if (result && !result.ok) {
        if (result.conflictType === "QUARANTINE_RESURRECTION") {
          setResurrectionConflict({
            contactoId:   result.quarantineContactoId,
            contactoName: result.contactoName,
            pendingInput:   input,
            pendingAddress: addressPayload,
          });
          setError(null);
        } else if (result.conflictType === "CROSS_MATRIX") {
          setCrossMatrixConflict({
            contactoId:   result.quarantineContactoId,
            contactoName: result.contactoName,
            message:      result.error,
          });
          setError(null);
        } else {
          setError(result.error);
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        }
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* Breadcrumb + Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/contactos" className="hover:text-zinc-300">
            Directorio de Contactos
          </Link>
          <span>/</span>
          <span className="text-zinc-400">Nuevo Contacto</span>
        </div>
        <h1 className="mt-2 text-lg font-semibold text-zinc-100">Añadir Nuevo Contacto</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Rellena los datos del cliente o contacto que deseas registrar.
        </p>
      </div>

      {/* ── Banner: Datos autocompletados con éxito ── */}
      {fillSuccess.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Datos autocompletados con éxito:</strong>{" "}
            {fillSuccess.join(", ")}.{" "}
            <span className="text-emerald-600">Completa el identificador fiscal para continuar.</span>
          </span>
          <button
            type="button"
            onClick={() => setFillSuccess([])}
            className="ml-auto text-emerald-700 transition-colors hover:text-emerald-500"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Banner: Resurrección — NIF en Cuarentena detectado ── */}
      {resurrectionConflict && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">
                Contacto encontrado en el Archivo de Cuarentena
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-400/80">
                <span className="font-semibold text-amber-300">{resurrectionConflict.contactoName}</span>{" "}
                ya existe en el sistema con este identificador fiscal, pero está archivado en cuarentena.
                Puedes restaurarlo y actualizar sus datos con los que acabas de introducir.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await resurrectionRestoreContacto(
                        resurrectionConflict.contactoId,
                        resurrectionConflict.pendingInput,
                        resurrectionConflict.pendingAddress
                      );
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                  {isPending ? "Restaurando…" : "Restaurar y actualizar datos"}
                </button>
                <button
                  type="button"
                  onClick={() => setResurrectionConflict(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Vínculo Inter-Matriz ── */}
      {crossMatrixConflict && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-purple-300">
                Contacto detectado en el Holding
              </p>
              <p className="mt-1 text-xs leading-relaxed text-purple-400/80">
                <span className="font-semibold text-purple-300">{crossMatrixConflict.contactoName}</span>{" "}
                ya existe en otra matriz del Holding. Puedes importarlo a{" "}
                <span className="font-semibold text-purple-300">{tenant.nombre}</span>{" "}
                sin duplicar el registro.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await vincularContactoAMatriz(
                        crossMatrixConflict.contactoId,
                        tenant.id
                      );
                      if (res.ok) {
                        window.location.href = `/contactos/${crossMatrixConflict.contactoId}`;
                      } else {
                        setError(res.error);
                        setCrossMatrixConflict(null);
                      }
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-300 transition-colors hover:bg-purple-500/30 disabled:opacity-50"
                >
                  {isPending ? "Importando…" : `Importar a ${tenant.shortLabel}`}
                </button>
                <button
                  type="button"
                  onClick={() => setCrossMatrixConflict(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner de error global */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--alert-error-bg)",
            borderColor:     "var(--alert-error-border)",
            color:           "var(--alert-error-text)",
          }}
        >
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: "var(--alert-error-icon)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

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
              <input name="nombre" type="text" placeholder="María" className={fieldErrors.nombre ? inputError : inputNormal} />
            </FieldGroup>
            <FieldGroup label="Primer apellido" error={fieldErrors.apellido1}>
              <input name="apellido1" type="text" placeholder="García" className={fieldErrors.apellido1 ? inputError : inputNormal} />
            </FieldGroup>
            <FieldGroup label="Segundo apellido" error={fieldErrors.apellido2}>
              <input name="apellido2" type="text" placeholder="López" className={fieldErrors.apellido2 ? inputError : inputNormal} />
            </FieldGroup>
          </div>
        ) : (
          <div key={`pj-${resetKey}`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            {/* Razón Social + buscador Google Places */}
            <div className="sm:col-span-2">
              <FieldGroup label="Razón Social" required error={fieldErrors.razon_social}>
                {/* Input con botón de búsqueda incrustado */}
                <div className="relative">
                  <input
                    type="text"
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    placeholder="Empresa S.L."
                    className={`${fieldErrors.razon_social ? inputError : inputNormal} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCompanySearch((v) => !v)}
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
              </FieldGroup>

              {/* Widget de búsqueda */}
              {showCompanySearch && (
                <CompanyAutocompleteInput
                  onNameFill={(name) => setRazonSocial(name)}
                  onAddressFill={(addr) => setDetectedAddress(addr)}
                  onPhoneFill={(phone, type) => {
                    if (type === "movil") setTelefonoMovil(phone);
                    else setTelefonoFijo(phone);
                  }}
                  onWebsiteFill={(url) => setWebsiteUrl(url)}
                  onClose={() => setShowCompanySearch(false)}
                  onFillComplete={handleFillComplete}
                />
              )}

              {/* Tarjeta de dirección detectada */}
              {detectedAddress && (
                <div
                  className={`mt-2 rounded-lg border px-3 py-2.5 text-xs ${
                    detectedAddress.isIncomplete
                      ? "border-amber-700/40 bg-amber-950/20"
                      : "border-zinc-700 bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        detectedAddress.isIncomplete ? "text-amber-400" : "text-zinc-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      {detectedAddress.isIncomplete && (
                        <p className="mb-1 font-semibold text-amber-400">
                          Dirección incompleta, requiere revisión manual
                        </p>
                      )}
                      {detectedAddress.calle && (
                        <p className="text-zinc-300">{detectedAddress.calle}</p>
                      )}
                      <p className="text-zinc-500">
                        {[
                          detectedAddress.codigo_postal,
                          detectedAddress.ciudad,
                          detectedAddress.provincia,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {detectedAddress.pais && (
                        <p className="text-zinc-600">{detectedAddress.pais}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetectedAddress(null)}
                      className="ml-auto shrink-0 text-zinc-600 transition-colors hover:text-zinc-400"
                      aria-label="Eliminar dirección detectada"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
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
                ref={fiscalIdRef}
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
            <FieldGroup label="Email Principal" icon={<Mail className="h-3.5 w-3.5" />} error={fieldErrors.email_principal}>
              <input
                name="email_principal"
                type="email"
                value={emailPrincipal}
                onChange={(e) => setEmailPrincipal(e.target.value)}
                placeholder="contacto@empresa.es"
                className={fieldErrors.email_principal ? inputError : inputNormal}
              />
            </FieldGroup>

            <FieldGroup label="Teléfono Móvil" icon={<Smartphone className="h-3.5 w-3.5" />} error={fieldErrors.telefono_movil}>
              <CustomPhoneInput value={telefonoMovil} onChange={setTelefonoMovil} error={fieldErrors.telefono_movil} />
            </FieldGroup>

            <FieldGroup label="Teléfono Fijo" icon={<Phone className="h-3.5 w-3.5" />} error={fieldErrors.telefono_fijo}>
              <CustomPhoneInput value={telefonoFijo} onChange={setTelefonoFijo} error={fieldErrors.telefono_fijo} />
            </FieldGroup>

            <FieldGroup label="Sitio Web" icon={<Globe className="h-3.5 w-3.5" />} error={fieldErrors.website_url}>
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

            <FieldGroup label="LinkedIn" icon={<Link2 className="h-3.5 w-3.5" />} error={fieldErrors.linkedin_url}>
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
                Guardar Contacto
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
