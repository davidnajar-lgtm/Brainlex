// ============================================================================
// app/contactos/[id]/editar/page.tsx — Vista de Edición de Contacto
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.4 — Edición de Contactos
// ============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";

import { getContactoById } from "@/lib/actions/contactos.actions";
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
    <div className="mx-auto max-w-2xl space-y-6">
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
