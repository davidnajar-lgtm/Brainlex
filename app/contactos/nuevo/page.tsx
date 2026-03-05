"use client";

// ============================================================================
// app/contactos/nuevo/page.tsx — Formulario de Alta de Contacto
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.3 — Formulario de Alta de Contactos
// ============================================================================

import { useTransition, useState } from "react";
import Link from "next/link";

import { createContacto, CreateContactoInput } from "@/lib/actions/contactos.actions";
import { ContactoTipo, FiscalIdTipo } from "@prisma/client";

// ─── Constantes ───────────────────────────────────────────────────────────────

const FISCAL_ID_TIPOS: { value: FiscalIdTipo; label: string }[] = [
  { value: FiscalIdTipo.NIF, label: "NIF" },
  { value: FiscalIdTipo.CIF, label: "CIF" },
  { value: FiscalIdTipo.NIE, label: "NIE" },
  { value: FiscalIdTipo.DNI, label: "DNI" },
  { value: FiscalIdTipo.PASAPORTE, label: "Pasaporte" },
  { value: FiscalIdTipo.VAT, label: "VAT (UE)" },
  { value: FiscalIdTipo.TIE, label: "TIE" },
  { value: FiscalIdTipo.REGISTRO_EXTRANJERO, label: "Registro Extranjero" },
  { value: FiscalIdTipo.CODIGO_SOPORTE, label: "Código de Soporte" },
  { value: FiscalIdTipo.SIN_REGISTRO, label: "Sin Registro" },
];

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function FieldGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30";

const selectClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30";

// ─── Página ───────────────────────────────────────────────────────────────────

export default function NuevoContactoPage() {
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<ContactoTipo>(ContactoTipo.PERSONA_FISICA);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const input: CreateContactoInput = {
      tipo,
      nombre: fd.get("nombre") as string | undefined,
      apellido1: fd.get("apellido1") as string | undefined,
      apellido2: fd.get("apellido2") as string | undefined,
      razon_social: fd.get("razon_social") as string | undefined,
      fiscal_id_tipo: fd.get("fiscal_id_tipo") as FiscalIdTipo,
      fiscal_id: fd.get("fiscal_id") as string,
      email: fd.get("email") as string | undefined,
      telefono: fd.get("telefono") as string | undefined,
    };

    startTransition(async () => {
      const result = await createContacto(input);
      if (result && !result.ok) {
        setError(result.error);
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
        <h1 className="mt-2 text-lg font-semibold text-zinc-100">
          Añadir Nuevo Contacto
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Rellena los datos del cliente o contacto que deseas registrar.
        </p>
      </div>

      {/* Error banner */}
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

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
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
                onClick={() => setTipo(opt.value)}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldGroup label="Nombre" required>
              <input
                name="nombre"
                type="text"
                required
                placeholder="María"
                className={inputClass}
              />
            </FieldGroup>
            <FieldGroup label="Primer apellido" required>
              <input
                name="apellido1"
                type="text"
                required
                placeholder="García"
                className={inputClass}
              />
            </FieldGroup>
            <FieldGroup label="Segundo apellido">
              <input
                name="apellido2"
                type="text"
                placeholder="López"
                className={inputClass}
              />
            </FieldGroup>
          </div>
        ) : (
          <FieldGroup label="Razón Social" required>
            <input
              name="razon_social"
              type="text"
              required
              placeholder="Empresa S.L."
              className={inputClass}
            />
          </FieldGroup>
        )}

        {/* ── Identificación Fiscal ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldGroup label="Tipo de ID Fiscal" required>
            <select name="fiscal_id_tipo" required className={selectClass}>
              {FISCAL_ID_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FieldGroup>
          <div className="sm:col-span-2">
            <FieldGroup label="Número de Identificación" required>
              <input
                name="fiscal_id"
                type="text"
                required
                placeholder="12345678A"
                className={`${inputClass} font-mono tracking-widest`}
              />
            </FieldGroup>
          </div>
        </div>

        {/* ── Contacto ── */}
        <div className="border-t border-zinc-800 pt-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Datos de Contacto (opcionales)
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Email">
              <input
                name="email"
                type="email"
                placeholder="contacto@empresa.es"
                className={inputClass}
              />
            </FieldGroup>
            <FieldGroup label="Teléfono">
              <input
                name="telefono"
                type="tel"
                placeholder="+34 600 000 000"
                className={inputClass}
              />
            </FieldGroup>
          </div>
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
                Guardar Contacto
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
