"use client";

// ============================================================================
// app/contactos/[id]/editar/EditContactoForm.tsx — Formulario de Edición
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.4 / 2.5 — Edición + Validación Zod por campo
// ============================================================================

import { useTransition, useState } from "react";
import Link from "next/link";
import { CustomPhoneInput } from "@/app/contactos/CustomPhoneInput";
import { SociedadCombobox } from "@/app/contactos/SociedadCombobox";
import { updateContacto } from "@/lib/actions/contactos.actions";
import type {
  UpdateContactoInput,
  ContactoFieldErrors,
} from "@/lib/validations/contacto.schema";
import { Contacto, ContactoTipo, FiscalIdTipo, TipoTelefono } from "@prisma/client";

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
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
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

// ─── Componente principal ─────────────────────────────────────────────────────

export function EditContactoForm({ contacto }: { contacto: Contacto }) {
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<ContactoTipo>(contacto.tipo);
  const [resetKey, setResetKey] = useState(0);
  const [fiscalIdTipo, setFiscalIdTipo] = useState<FiscalIdTipo>(
    contacto.fiscal_id_tipo ?? FiscalIdTipo.NIF
  );
  const [fiscalId, setFiscalId] = useState(contacto.fiscal_id ?? "");
  const [telefono, setTelefono] = useState<string>(contacto.telefono ?? "");
  const [tipoTelefono, setTipoTelefono] = useState<TipoTelefono>(
    contacto.tipo_telefono ?? TipoTelefono.MOVIL
  );
  const [tipoSociedad, setTipoSociedad] = useState<string>(
    contacto.tipo_sociedad ?? ""
  );
  const [esCliente, setEsCliente] = useState(contacto.es_cliente ?? false);
  const [notas, setNotas] = useState<string>(contacto.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactoFieldErrors>({});

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
      email:         (fd.get("email")        as string) || undefined,
      telefono:      telefono || undefined,
      tipo_telefono: tipoTelefono,
      tipo_sociedad: tipoSociedad || undefined,
      es_cliente:    esCliente,
      notas:         notas || undefined,
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
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {error}
        </div>
      )}

      {/* ── Tipo ── */}
      <FieldGroup label="Tipo de Contacto" required>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: ContactoTipo.PERSONA_FISICA, label: "Persona Física" },
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
            <input
              name="nombre"
              type="text"
              defaultValue={contacto.nombre ?? ""}
              placeholder="María"
              className={fieldErrors.nombre ? inputError : inputNormal}
            />
          </FieldGroup>
          <FieldGroup label="Primer apellido" error={fieldErrors.apellido1}>
            <input
              name="apellido1"
              type="text"
              defaultValue={contacto.apellido1 ?? ""}
              placeholder="García"
              className={fieldErrors.apellido1 ? inputError : inputNormal}
            />
          </FieldGroup>
          <FieldGroup label="Segundo apellido" error={fieldErrors.apellido2}>
            <input
              name="apellido2"
              type="text"
              defaultValue={contacto.apellido2 ?? ""}
              placeholder="López"
              className={fieldErrors.apellido2 ? inputError : inputNormal}
            />
          </FieldGroup>
        </div>
      ) : (
        <div key={`pj-${resetKey}`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <FieldGroup label="Razón Social" required error={fieldErrors.razon_social}>
              <input
                name="razon_social"
                type="text"
                defaultValue={contacto.razon_social ?? ""}
                placeholder="Empresa S.L."
                className={fieldErrors.razon_social ? inputError : inputNormal}
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Tipo de Sociedad" required error={fieldErrors.tipo_sociedad}>
            <SociedadCombobox
              value={tipoSociedad}
              onChange={setTipoSociedad}
              error={fieldErrors.tipo_sociedad}
            />
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
            {(tipo === ContactoTipo.PERSONA_FISICA
              ? FISCAL_ID_TIPOS_PF
              : FISCAL_ID_TIPOS_PJ
            ).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
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

      {/* ── Datos de contacto ── */}
      <div className="border-t border-zinc-800 pt-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Datos de Contacto (opcionales)
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup label="Email" error={fieldErrors.email}>
            <input
              name="email"
              type="email"
              defaultValue={contacto.email ?? ""}
              placeholder="contacto@empresa.es"
              className={fieldErrors.email ? inputError : inputNormal}
            />
          </FieldGroup>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Teléfono
              </label>
              <div className="flex rounded-md border border-zinc-700 overflow-hidden">
                {([TipoTelefono.MOVIL, TipoTelefono.FIJO] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipoTelefono(t)}
                    className={`px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      tipoTelefono === t
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t === TipoTelefono.MOVIL ? "Móvil" : "Fijo"}
                  </button>
                ))}
              </div>
            </div>
            <CustomPhoneInput
              value={telefono}
              onChange={setTelefono}
              error={fieldErrors.telefono}
            />
          </div>
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
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 resize-none"
          />
        </FieldGroup>
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-5">
        <Link
          href="/contactos"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
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
