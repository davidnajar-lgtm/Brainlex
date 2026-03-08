// ============================================================================
// app/admin/cuarentena/page.tsx — Guardian Dashboard
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 1.2 — Gestión del Ciclo de Vida (QUARANTINE)
//
// Lista todos los contactos en QUARANTINE con:
//   · Nombre / NIF
//   · Fecha de entrada en cuarentena (updated_at proxy)
//   · Contador regresivo "Days to Purge"
//   · Botón Restaurar (QUARANTINE → ACTIVE)
//   · Botón Pass Away (borrado físico — vetado si tiene expedientes)
// ============================================================================

import Link from "next/link";
import { ShieldAlert, RotateCcw, Clock, Skull, CheckCircle2 } from "lucide-react";
import { contactoRepository } from "@/lib/modules/entidades/repositories/contacto.repository";
import { RestoreButton } from "@/app/contactos/_modules/ficha/RestoreButton";
import { PassAwayButton } from "./_components/PassAwayButton";
import { NifVerifier } from "./_components/NifVerifier";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysToExpiry(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  }).format(date);
}

function DaysCounter({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-zinc-600 text-xs">Sin plazo</span>;
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400 ring-1 ring-red-500/20">
        <Skull className="h-3 w-3" />
        VENCIDO ({Math.abs(days)}d)
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/20">
        <Clock className="h-3 w-3" />
        {days}d restantes
      </span>
    );
  }
  return (
    <span className="text-xs tabular-nums text-zinc-500">
      {days}d restantes
    </span>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function GuardianDashboardPage() {
  const contacts = await contactoRepository.findAllQuarantine();

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
        <div className="shrink-0 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-center">
          <p className="text-2xl font-bold tabular-nums text-amber-400">{contacts.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
            En Cuarentena
          </p>
        </div>
      </div>

      {/* Lista vacía */}
      {contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-24 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-400">
            Archivo de cuarentena vacío
          </h3>
          <p className="mt-1 text-xs text-zinc-600">
            No hay contactos en cuarentena en este momento.
          </p>
        </div>
      )}

      {/* Tabla */}
      {contacts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {/* Cabecera */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-zinc-800 bg-zinc-900/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>Contacto / NIF</span>
            <span className="text-right">En cuarentena desde</span>
            <span className="text-right">Expira</span>
            <span className="text-center">Restaurar</span>
            <span className="text-center">Pass Away</span>
          </div>

          {/* Filas */}
          <div className="divide-y divide-zinc-800/60">
            {contacts.map((c) => {
              const days = daysToExpiry(c.quarantine_expires_at);
              const displayName =
                c.razon_social ||
                [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(" ") ||
                "—";

              return (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-start gap-4 bg-zinc-900/40 px-5 py-4 hover:bg-zinc-900/70 transition-colors"
                >
                  {/* Nombre + NIF + motivo */}
                  <div className="min-w-0">
                    <Link
                      href={`/contactos/${c.id}?tab=admin`}
                      className="group inline-flex items-center gap-1 hover:underline"
                    >
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-amber-300 transition-colors truncate max-w-xs">
                        {displayName}
                      </span>
                    </Link>
                    {c.fiscal_id && (
                      <p className="font-mono text-[11px] text-zinc-500">{c.fiscal_id_tipo} · {c.fiscal_id}</p>
                    )}
                    {c.quarantine_reason && (
                      <p className="mt-1 text-[10px] leading-relaxed text-zinc-600 line-clamp-2 max-w-xs">
                        {c.quarantine_reason}
                      </p>
                    )}
                  </div>

                  {/* Entrada en cuarentena (proxy: updated_at) */}
                  <div className="pt-0.5 text-right text-xs text-zinc-500 whitespace-nowrap">
                    {formatDate(c.updated_at)}
                  </div>

                  {/* Contador regresivo */}
                  <div className="pt-0.5 flex justify-end">
                    <DaysCounter days={days} />
                  </div>

                  {/* Restaurar */}
                  <div className="flex justify-center">
                    <RestoreButton contactoId={c.id} />
                  </div>

                  {/* Pass Away */}
                  <div className="flex justify-center">
                    <PassAwayButton
                      contactoId={c.id}
                      expedientesCount={c._count.expedientes}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
