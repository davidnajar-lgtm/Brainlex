// ============================================================================
// app/contactos/[id]/page.tsx — Ficha Ampliada del Contacto
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.6 — Dashboard de Contacto (scaffold)
// ============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ContactoTipo } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDisplayName(contacto: {
  tipo: ContactoTipo;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  razon_social: string | null;
}): string {
  if (contacto.tipo === ContactoTipo.PERSONA_JURIDICA) {
    return contacto.razon_social ?? "—";
  }
  return (
    [contacto.nombre, contacto.apellido1, contacto.apellido2]
      .filter(Boolean)
      .join(" ") || "—"
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContactoFichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contacto = await prisma.contacto.findUnique({ where: { id } });
  if (!contacto) notFound();

  const displayName = getDisplayName(contacto);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/contactos" className="hover:text-zinc-300">
          Directorio de Contactos
        </Link>
        <span>/</span>
        <span className="text-zinc-400">{displayName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {contacto.tipo === ContactoTipo.PERSONA_JURIDICA
              ? "Persona Jurídica"
              : "Persona Física"}
            {contacto.fiscal_id && (
              <span className="ml-2 font-mono text-zinc-400">
                · {contacto.fiscal_id_tipo} {contacto.fiscal_id}
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/contactos/${id}/editar`}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </Link>
      </div>

      {/* Dashboard placeholder */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["Expedientes", "Documentos", "Facturación"] as const).map((seccion) => (
          <div
            key={seccion}
            className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 border-dashed bg-zinc-900/50 py-12 text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800">
              <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-500">{seccion}</p>
            <p className="mt-1 text-xs text-zinc-700">En construcción</p>
          </div>
        ))}
      </div>

      {/* Notas */}
      {contacto.notas && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Notas / Observaciones
          </p>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{contacto.notas}</p>
        </div>
      )}
    </div>
  );
}
