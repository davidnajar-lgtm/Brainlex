// ============================================================================
// app/contactos/_modules/ficha/TabOperativa.tsx — Pestaña Operativa
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.6 — Panel Expedientes vinculados al Contacto
//
// RSC: hace su propia query a Prisma sin necesidad de props de datos.
// ============================================================================

import Link from "next/link";
import { Briefcase, ExternalLink, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getContactosLabels, type AppLocale } from "@/lib/i18n/contactos";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExpedienteRow = {
  id:          string;
  codigo:      string;
  titulo:      string;
  status:      string;
  company_id:  string;
  created_at:  Date;
  fuera_de_cuota: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusClasses(status: string): string {
  const map: Record<string, string> = {
    ABIERTO:    "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    CERRADO:    "bg-zinc-700/40    text-zinc-500    ring-zinc-600/20",
    SUSPENDIDO: "bg-amber-500/10   text-amber-400   ring-amber-500/20",
    ARCHIVADO:  "bg-zinc-800/40    text-zinc-600    ring-zinc-700/20",
  };
  return map[status] ?? "bg-zinc-700/40 text-zinc-500 ring-zinc-600/20";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  }).format(date);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export async function TabOperativa({
  contactoId,
  locale = "es",
}: {
  contactoId: string;
  locale?:    AppLocale;
}) {
  const t = getContactosLabels(locale);
  const expedientes: ExpedienteRow[] = await prisma.expediente.findMany({
    where:   { contacto_id: contactoId },
    orderBy: { created_at: "desc" },
    select: {
      id:             true,
      codigo:         true,
      titulo:         true,
      status:         true,
      company_id:     true,
      created_at:     true,
      fuera_de_cuota: true,
    },
  });

  if (expedientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/70">
          <Briefcase className="h-6 w-6 text-zinc-500" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-zinc-400">
          {t.operativa.sinExpedientes}
        </h3>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-600">
          {t.operativa.sinExpedientesDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Contador */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          <span className="font-semibold text-zinc-300">{expedientes.length}</span>{" "}
          {t.operativa.expedientesVinculados}
        </p>
      </div>

      {/* Lista */}
      <ul className="flex flex-col gap-3">
        {expedientes.map((exp) => (
          <li key={exp.id}>
            <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700">
              <div className="flex items-start justify-between gap-3">
                {/* Código + título */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-semibold tracking-widest text-zinc-500">
                      {exp.codigo}
                    </span>
                    {/* Tenant badge */}
                    <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                      {exp.company_id}
                    </span>
                    {/* Semáforo Zero Leakage */}
                    {exp.fuera_de_cuota && (
                      <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 ring-1 ring-red-500/20">
                        {t.operativa.fueraDeCuota}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-zinc-200">
                    {exp.titulo}
                  </p>
                </div>

                {/* Status + fecha + acción */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusClasses(exp.status)}`}
                  >
                    {exp.status}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                    <Clock className="h-3 w-3" />
                    {formatDate(exp.created_at)}
                  </div>
                </div>
              </div>

              {/* Enlace (futuro: /expedientes/[id]) */}
              <div className="mt-3 flex items-center gap-1 text-[11px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3 w-3" />
                <span>{t.operativa.verExpediente}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
