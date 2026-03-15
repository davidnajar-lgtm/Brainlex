// ============================================================================
// lib/modules/entidades/actions/backfill-audit.action.ts
//
// @role: @Security-CISO — Backfill de AuditLog para contactos existentes
//
// Genera un registro AuditLog CREATE para cada contacto que NO tenga ningún
// registro de auditoría. Usa el created_at del contacto como fecha del log.
//
// Idempotente: si el contacto ya tiene al menos un AuditLog, se salta.
//
// Uso:
//   - Desde admin UI: importar y llamar backfillAuditLogs()
//   - Desde CLI:      npx tsx lib/modules/entidades/actions/backfill-audit.action.ts
// ============================================================================
"use server";

import { prisma } from "@/lib/prisma";
import { ContactoTipo } from "@prisma/client";

export type BackfillAuditResult = {
  ok: true;
  created: number;
  skipped: number;
  total: number;
};

/**
 * Backfill: crea un AuditLog CREATE retroactivo para contactos sin historial.
 * Idempotente — seguro de ejecutar múltiples veces.
 */
export async function backfillAuditLogs(): Promise<BackfillAuditResult> {
  // Todos los contactos
  const contactos = await prisma.contacto.findMany({
    select: {
      id: true,
      nombre: true,
      apellido1: true,
      razon_social: true,
      tipo: true,
      created_at: true,
    },
  });

  // IDs de contactos que ya tienen al menos un AuditLog
  const existingLogs = await prisma.auditLog.findMany({
    where: {
      table_name: "contactos",
      record_id: { in: contactos.map((c) => c.id) },
    },
    select: { record_id: true },
  });
  const hasLog = new Set(existingLogs.map((l) => l.record_id));

  // Filtrar contactos sin AuditLog
  const missing = contactos.filter((c) => !hasLog.has(c.id));

  if (missing.length === 0) {
    return { ok: true, created: 0, skipped: contactos.length, total: contactos.length };
  }

  // Crear logs en batch
  const data = missing.map((c) => {
    const displayName =
      c.tipo === ContactoTipo.PERSONA_JURIDICA
        ? c.razon_social ?? "—"
        : [c.nombre, c.apellido1].filter(Boolean).join(" ") || "—";

    return {
      table_name: "contactos",
      record_id: c.id,
      action: "CREATE" as const,
      notes: `Contacto creado: ${displayName} (${c.tipo})`,
      created_at: c.created_at,
    };
  });

  await prisma.auditLog.createMany({ data });

  return {
    ok: true,
    created: missing.length,
    skipped: contactos.length - missing.length,
    total: contactos.length,
  };
}
