// ============================================================================
// lib/repositories/sujeto.repository.ts — Capa de Acceso a Datos
//
// Responsabilidad ÚNICA: operaciones atómicas contra la BD via Prisma.
// CERO lógica de negocio aquí. Las decisiones las toma la capa de servicio.
// ============================================================================
import { AuditAction, Sujeto, SujetoStatus } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";

// ─── DTOs internos del repositorio ──────────────────────────────────────────

export type SujetoWithDependencyCounts = Sujeto & {
  _count: { expedientes: number };
};

export interface QuarantineData {
  quarantine_reason: string;
  quarantine_expires_at: Date;
}

export interface AuditEntry {
  table_name: string;
  record_id: string;
  action: AuditAction;
  actor_id?: string;
  actor_email?: string;
  ip_address?: string;
  user_agent?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  notes?: string;
}

// ─── Repositorio ─────────────────────────────────────────────────────────────

export const sujetoRepository = {
  /**
   * Busca un Sujeto por ID incluyendo conteo de expedientes asociados.
   * Usado por la capa de servicio para la Fase 1 (Auditoría de dependencias).
   */
  async findByIdWithCounts(
    id: string
  ): Promise<SujetoWithDependencyCounts | null> {
    return prisma.sujeto.findUnique({
      where: { id },
      include: { _count: { select: { expedientes: true } } },
    });
  },

  /**
   * Borrado físico. SOLO la capa de servicio puede llamar esto,
   * y únicamente tras verificar cero dependencias legales.
   */
  async hardDelete(id: string): Promise<void> {
    await prisma.sujeto.delete({ where: { id } });
  },

  /**
   * Transición atómica a QUARANTINE.
   * quarantine_reason y quarantine_expires_at vienen siempre del servicio (ya validados).
   */
  async setQuarantine(id: string, data: QuarantineData): Promise<Sujeto> {
    return prisma.sujeto.update({
      where: { id },
      data: {
        status: SujetoStatus.QUARANTINE,
        quarantine_reason: data.quarantine_reason,
        quarantine_expires_at: data.quarantine_expires_at,
      },
    });
  },

  /**
   * Escribe una entrada INMUTABLE en el AuditLog.
   * Esta tabla nunca recibe UPDATE ni DELETE (diseño deliberado del schema).
   */
  async appendAuditLog(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({ data: entry });
  },
};

// ─── Repositorio de SociedadHolding (solo lectura aquí) ──────────────────────

export const sociedadRepository = {
  /**
   * Obtiene los meses de cuarentena configurados para un tenant concreto.
   * Retorna null si el tenant no existe.
   */
  async getQuarantineMonths(
    company_id: string
  ): Promise<{ quarantine_months: number } | null> {
    return prisma.sociedadHolding.findUnique({
      where: { company_id },
      select: { quarantine_months: true },
    });
  },
};
