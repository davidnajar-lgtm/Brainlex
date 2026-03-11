// ============================================================================
// app/contactos/[id]/editar/page.tsx — Vista de Edición de Contacto
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.4 — Edición de Contactos
// ============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilLine } from "lucide-react";

import { getContactoById } from "@/lib/modules/entidades/actions/contactos.actions";
import { EditContactoForm } from "./EditContactoForm";

export default async function EditarContactoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getContactoById(id);

  if (!result.ok) notFound();

  const contacto = result.data;

  return (
    <div
      className="mx-auto max-w-2xl space-y-6 rounded-2xl border-2 p-6"
      style={{
        borderColor: "var(--alert-warning-frame)",
        boxShadow:   "0 0 0 4px color-mix(in oklch, var(--alert-warning-frame) 15%, transparent)",
      }}
    >

      {/* ── Banner Modo Edición Inequívoco (Micro-Spec 2.3) ── */}
      <div
        className="flex items-center gap-2 rounded-lg border px-4 py-2.5"
        style={{
          backgroundColor: "var(--alert-warning-bg)",
          borderColor:     "var(--alert-warning-border)",
        }}
      >
        <PencilLine className="h-4 w-4 shrink-0" style={{ color: "var(--alert-warning-icon)" }} />
        <p className="text-xs font-semibold" style={{ color: "var(--alert-warning-text)" }}>
          MODO EDICIÓN ACTIVO —{" "}
          <span className="font-normal" style={{ color: "var(--alert-warning-text-muted)" }}>
            Los cambios no se guardarán hasta confirmar
          </span>
        </p>
      </div>

      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/contactos" className="hover:text-zinc-300">
            Directorio de Contactos
          </Link>
          <span>/</span>
          <span className="text-zinc-400">Editar Contacto</span>
        </div>
        <h1 className="mt-2 text-lg font-semibold text-zinc-100">
          Editar Contacto
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Modifica los datos del contacto. Los cambios se registrarán en el historial.
        </p>
      </div>

      <EditContactoForm contacto={contacto} />
    </div>
  );
}
