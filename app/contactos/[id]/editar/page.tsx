// ============================================================================
// app/contactos/[id]/editar/page.tsx — DEPRECATED: Redirect to ficha
//
// @spec: Fase 10.06 — La ficha del contacto es el único punto de edición.
//        Esta ruta se mantiene como redirect para URLs bookmarkeadas.
// ============================================================================

import { redirect } from "next/navigation";

export default async function EditarContactoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/contactos/${id}?tab=filiacion`);
}
