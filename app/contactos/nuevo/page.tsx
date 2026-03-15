// ============================================================================
// app/contactos/nuevo/page.tsx — DEPRECADO
//
// @role: Agente de Frontend (React Server Component)
// @spec: Fase 9.1 — Redirige a /contactos
//
// Este formulario ha sido reemplazado por el flujo ficha-céntrico:
//   1. Alta Rápida (QuickCreateModal) → crea contacto con datos mínimos
//   2. Ficha del contacto (tab Filiación) → edita identidad, canales, direcciones
//
// Se mantiene como redirect para compatibilidad con URLs bookmarkeadas.
// ============================================================================

import { redirect } from "next/navigation";

export default function NuevoContactoPage() {
  redirect("/contactos");
}
