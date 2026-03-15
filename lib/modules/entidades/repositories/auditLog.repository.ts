// ============================================================================
// lib/modules/entidades/repositories/auditLog.repository.ts
//
// @role: @Security-CISO
// @spec: Repositorio centralizado de AuditLog — INMUTABLE
//
// Punto único de escritura para la tabla AuditLog.
// Esta tabla NUNCA recibe UPDATE ni DELETE (diseño deliberado del schema).
// ============================================================================

import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  table_name: string;
  record_id: string;
  action:    AuditAction;
  actor_id?:    string;
  actor_email?: string;
  notes?:       string;
}

// ─── Repositorio ────────────────────────────────────────────────────────────

export const auditLogRepository = {
  /**
   * Escribe una entrada INMUTABLE en el AuditLog.
   * REGLA CISO: se escribe ANTES de mutar el estado.
   */
  async append(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({ data: entry });
  },

  /**
   * Obtiene las últimas N entradas de AuditLog para un registro.
   */
  async findRecent(recordId: string, take = 3) {
    return prisma.auditLog.findMany({
      where: { record_id: recordId },
      orderBy: { created_at: "desc" },
      take,
    });
  },
};
