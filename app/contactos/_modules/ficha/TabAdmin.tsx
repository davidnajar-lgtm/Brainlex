// ============================================================================
// app/contactos/_modules/ficha/TabAdmin.tsx — Pestaña Administración
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.6 — Panel Compliance + Ciclo de vida + AuditLog
//
// Secciones:
//   1. Panel de Ciclo de Vida — estado actual, cuarentena, botón Restaurar
//   2. AuditLog — historial inmutable de acciones sobre el contacto
// ============================================================================

import { CheckCircle2, ShieldAlert, Eye, Trash2 } from "lucide-react";
import { contactoRepository } from "@/lib/modules/entidades/repositories/contacto.repository";
import { prisma } from "@/lib/prisma";
import { RestoreButton } from "./RestoreButton";
import { ArchiveButton } from "@/app/contactos/_modules/shared/ArchiveButton";
import type { AuditAction, AuditLog, ContactoStatus } from "@prisma/client";
import { getContactosLabels, type AppLocale } from "@/lib/i18n/contactos";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ICONS = {
  ACTIVE:     CheckCircle2,
  QUARANTINE: ShieldAlert,
  FORGOTTEN:  Trash2,
} as const;

const STATUS_CLASSES: Record<ContactoStatus, string> = {
  ACTIVE:     "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  QUARANTINE: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  FORGOTTEN:  "bg-red-500/10 text-red-400 ring-red-500/20",
};

const AUDIT_ACTION_CLASSES: Record<AuditAction, string> = {
  CREATE:     "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  READ:       "bg-zinc-700/40    text-zinc-500    ring-zinc-600/20",
  UPDATE:     "bg-blue-500/10    text-blue-400    ring-blue-500/20",
  QUARANTINE: "bg-amber-500/10   text-amber-400   ring-amber-500/20",
  RESTORE:    "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  FORGET:     "bg-red-500/10     text-red-400     ring-red-500/20",
};

const TABLE_NAME_LABELS: Record<string, string> = {
  contactos:             "Contacto",
  direcciones:           "Dirección",
  canales_comunicacion:  "Canal de comunicación",
  etiquetas:             "Etiqueta",
  relaciones:            "Relación",
  contacto_company_links: "Vínculo",
  evidencias_relacion:   "Evidencia",
  Carpeta:               "Bóveda",
  Archivo:               "Archivo",
};

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Regex para detectar CUIDs en las notes del AuditLog
const CUID_RE = /\b(c[a-z0-9]{20,30})\b/g;

/**
 * Resuelve CUIDs encontrados en las notes del AuditLog a nombres legibles.
 * Busca en contactos, relaciones (tipo+destino), y direcciones.
 * Los entries son inmutables — la humanización es solo para presentación.
 */
async function humanizeAuditNotes(entries: AuditLog[]): Promise<Map<string, string>> {
  // 1. Extraer todos los CUIDs únicos de todas las notes
  const allCuids = new Set<string>();
  for (const entry of entries) {
    if (!entry.notes) continue;
    for (const match of entry.notes.matchAll(CUID_RE)) {
      allCuids.add(match[1]);
    }
  }
  if (allCuids.size === 0) return new Map();

  const ids = [...allCuids];
  const nameMap = new Map<string, string>();

  // 2. Resolver contactos
  const contactos = await prisma.contacto.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, apellido1: true, razon_social: true, tipo: true },
  });
  for (const c of contactos) {
    const name = c.tipo === "PERSONA_JURIDICA"
      ? c.razon_social ?? "—"
      : [c.nombre, c.apellido1].filter(Boolean).join(" ") || "—";
    nameMap.set(c.id, name);
  }

  // 3. Resolver relaciones (tipo + otro contacto)
  const remaining = ids.filter((id) => !nameMap.has(id));
  if (remaining.length > 0) {
    const relaciones = await prisma.relacion.findMany({
      where: { id: { in: remaining } },
      select: {
        id: true,
        tipo_relacion: { select: { nombre: true } },
        origen: { select: { nombre: true, apellido1: true, razon_social: true, tipo: true } },
        destino: { select: { nombre: true, apellido1: true, razon_social: true, tipo: true } },
      },
    });
    for (const r of relaciones) {
      const dest = r.destino.tipo === "PERSONA_JURIDICA"
        ? r.destino.razon_social ?? "—"
        : [r.destino.nombre, r.destino.apellido1].filter(Boolean).join(" ") || "—";
      nameMap.set(r.id, `"${r.tipo_relacion.nombre}" con ${dest}`);
    }
  }

  // 4. Resolver direcciones
  const still = ids.filter((id) => !nameMap.has(id));
  if (still.length > 0) {
    const dirs = await prisma.direccion.findMany({
      where: { id: { in: still } },
      select: { id: true, calle: true, ciudad: true, tipo: true },
    });
    for (const d of dirs) {
      nameMap.set(d.id, [d.calle, d.ciudad].filter(Boolean).join(", ") || d.tipo);
    }
  }

  return nameMap;
}

function replaceIds(notes: string, nameMap: Map<string, string>): string {
  return notes.replace(CUID_RE, (match) => nameMap.get(match) ?? match);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export async function TabAdmin({
  contactoId,
  status,
  quarantineReason,
  quarantineExpiresAt,
  locale = "es",
}: {
  contactoId:          string;
  status:              ContactoStatus;
  quarantineReason:    string | null;
  quarantineExpiresAt: Date | null;
  locale?:             AppLocale;
}) {
  const t = getContactosLabels(locale);
  const auditLogs = await contactoRepository.findAuditLogs(contactoId);
  const nameMap = await humanizeAuditNotes(auditLogs);
  const StatusIcon = STATUS_ICONS[status];

  return (
    <div className="flex flex-col gap-6">

      {/* ═══════════════════════════════════════════════════════════════════
          Sección 1 — Ciclo de Vida
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {t.admin.cicloDeVida}
        </h3>

        {/* Estado actual */}
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800">
            <StatusIcon className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_CLASSES[status]}`}
            >
              {t.admin.statusLabel[status]}
            </span>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{t.admin.statusDesc[status]}</p>
          </div>
        </div>

        {/* Detalles de cuarentena (solo si QUARANTINE) */}
        {status === "QUARANTINE" && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            {quarantineReason && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                  {t.admin.motivoCuarentena}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-300/80">
                  {quarantineReason}
                </p>
              </div>
            )}
            {quarantineExpiresAt && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                  {t.admin.plazoConservacion}
                </p>
                <p className="mt-1 font-mono text-xs text-amber-300">
                  {formatDateTime(quarantineExpiresAt)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botón Archivar (solo si ACTIVE) */}
        {status === "ACTIVE" && (
          <ArchiveButton id={contactoId} />
        )}

        {/* Botón Restaurar (solo si QUARANTINE) */}
        {status === "QUARANTINE" && (
          <RestoreButton contactoId={contactoId} locale={locale} />
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          Sección 2 — AuditLog Inmutable
          ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-300">
            {t.admin.historialAuditoria}
          </h3>
          <span className="ml-auto text-[10px] text-zinc-600">
            {auditLogs.length}{" "}
            {auditLogs.length !== 1 ? t.admin.registros : t.admin.registro}
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-10">
            <p className="text-xs text-zinc-600">{t.emptyStates.noAuditLogs}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {auditLogs.map((entry) => {
              const label   = t.admin.auditAction[entry.action] ?? entry.action;
              const classes = AUDIT_ACTION_CLASSES[entry.action] ?? "bg-zinc-700/40 text-zinc-500 ring-zinc-600/20";
              const module  = TABLE_NAME_LABELS[entry.table_name] ?? entry.table_name;
              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${classes}`}
                      >
                        {label}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-medium">
                        {module}
                      </span>
                      {entry.actor_email && (
                        <span className="text-[11px] text-zinc-500">
                          {entry.actor_email}
                        </span>
                      )}
                    </div>
                    <time className="shrink-0 text-[10px] text-zinc-600 tabular-nums">
                      {formatDateTime(entry.created_at)}
                    </time>
                  </div>
                  {entry.notes && (
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                      {replaceIds(entry.notes, nameMap)}
                    </p>
                  )}
                  {entry.ip_address && (
                    <p className="mt-1 font-mono text-[10px] text-zinc-700">
                      IP: {entry.ip_address}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
