// ============================================================================
// app/contactos/_modules/ficha/MicroTimeline.tsx — Micro-Timeline (Hero)
//
// Muestra los últimos 2-3 eventos del AuditLog de forma sutil en la cabecera
// de la ficha del contacto. Complementa (no reemplaza) el AuditLog completo
// de la pestaña Admin.
// ============================================================================

import type { AuditAction } from "@prisma/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id:         string;
  action:     AuditAction;
  notes:      string | null;
  created_at: Date;
}

interface MicroTimelineProps {
  entries: AuditEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:     "Creado",
  READ:       "Consultado",
  UPDATE:     "Modificado",
  QUARANTINE: "Cuarentena",
  RESTORE:    "Restaurado",
  FORGET:     "Borrado RGPD",
};

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE:     "text-emerald-500",
  READ:       "text-zinc-600",
  UPDATE:     "text-blue-400",
  QUARANTINE: "text-amber-500",
  RESTORE:    "text-emerald-400",
  FORGET:     "text-red-400",
};

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins < 1)   return "ahora mismo";
  if (mins < 60)  return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return "ayer";
  if (days < 30)  return `hace ${days} días`;

  return new Intl.DateTimeFormat("es-ES", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  }).format(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  }).format(date);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MicroTimeline({ entries }: MicroTimelineProps) {
  if (entries.length === 0) return null;

  // El primer entry en orden desc es la actividad más reciente
  // El último entry (o el CREATE) es la fecha de creación
  const createEntry = entries.find((e) => e.action === "CREATE");
  const latestEntry = entries[0];

  // Si solo hay un CREATE, mostramos solo eso
  const showLatest = latestEntry && latestEntry.id !== createEntry?.id;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-600">
      {/* Fecha de creación */}
      {createEntry && (
        <span title={`Alta: ${formatDate(createEntry.created_at)}`}>
          <span className={ACTION_COLORS.CREATE}>●</span>{" "}
          Creado el {formatDate(createEntry.created_at)}
        </span>
      )}

      {/* Última actividad (si es diferente de CREATE) */}
      {showLatest && (
        <>
          <span className="text-zinc-700">·</span>
          <span
            title={`${ACTION_LABELS[latestEntry.action]}${latestEntry.notes ? `: ${latestEntry.notes}` : ""}`}
          >
            <span className={ACTION_COLORS[latestEntry.action]}>●</span>{" "}
            {ACTION_LABELS[latestEntry.action]} {timeAgo(latestEntry.created_at)}
          </span>
        </>
      )}
    </div>
  );
}
