// ============================================================================
// app/admin/cuarentena/page.tsx — Guardian Dashboard
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 1.2 + FASE 13.07 — Cuarentena reactiva al tenant
//
// RSC carga todos los contactos en cuarentena.
// CuarentenaTable (client) filtra según el tenant activo.
// ============================================================================

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { contactoRepository } from "@/lib/modules/entidades/repositories/contacto.repository";
import { NifVerifier } from "./_components/NifVerifier";
import { CuarentenaTable, type CuarentenaContact } from "./_components/CuarentenaTable";

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function GuardianDashboardPage() {
  const contacts = await contactoRepository.findAllQuarantine();

  // Serializar dates para pasar a client component
  const serialized: CuarentenaContact[] = contacts.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    apellido1: c.apellido1,
    apellido2: c.apellido2,
    razon_social: c.razon_social,
    fiscal_id: c.fiscal_id,
    fiscal_id_tipo: c.fiscal_id_tipo,
    quarantine_reason: c.quarantine_reason,
    quarantine_expires_at: c.quarantine_expires_at?.toISOString() ?? null,
    updated_at: c.updated_at.toISOString(),
    _count: c._count,
    company_links: c.company_links ?? [],
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/contactos" className="hover:text-zinc-300">Directorio</Link>
            <span>/</span>
            <span className="text-zinc-400">Guardian Dashboard</span>
          </div>
          <h1 className="mt-2 flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            Archivo de Cuarentena
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Contactos en estado QUARANTINE — ciclo de vida pendiente de resolución.
          </p>
        </div>

        {/* Counter is now inside CuarentenaTable (client-side, reflects filtered count) */}
      </div>

      {/* Client-side filtered table */}
      <CuarentenaTable contacts={serialized} />

      {/* Leyenda */}
      <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/20 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">Leyenda</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] text-zinc-500">
          <span><span className="text-amber-400 font-semibold">Restaurar</span> — Devuelve el contacto a ACTIVE con registro en AuditLog.</span>
          <span><span className="text-red-400 font-semibold">Pass Away</span> — Borrado físico irreversible. Genera certificado SHA-256 sin PII (RGPD Art.17).</span>
          <span><span className="text-red-400 font-semibold">VENCIDO</span> — El plazo legal ha expirado. Candidato a purga automática.</span>
        </div>
      </div>

      {/* Verificador RGPD */}
      <NifVerifier />

    </div>
  );
}
