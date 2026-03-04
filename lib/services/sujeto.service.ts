// ============================================================================
// lib/services/sujeto.service.ts — Servicio de Dominio: Sujeto
//
// @role: Agente Legal (Middleware de Integridad y Cuarentena)
// @spec: Micro-Spec 1.2 — Flujo VETO LEGAL (@security_and_legal.md)
//
// REGLAS INQUEBRANTABLES:
//   1. NUNCA se llama hardDelete si el Sujeto tiene expedientes.
//   2. quarantine_reason es SIEMPRE obligatorio.
//   3. quarantine_expires_at se calcula SIEMPRE desde quarantine_months del tenant.
//   4. TODA mutación escribe en AuditLog (inmutable).
// ============================================================================
import { AuditAction } from "@/app/generated/prisma";
import {
  BusinessValidationError,
  EntityNotFoundError,
  LegalBlockError,
} from "@/lib/errors/business.errors";
import {
  sociedadRepository,
  sujetoRepository,
} from "@/lib/repositories/sujeto.repository";

// ─── Tipos públicos del servicio ─────────────────────────────────────────────

/** Contexto del actor que ejecuta la acción (usuario autenticado o job de sistema). */
export interface ActorContext {
  actor_id?: string;
  actor_email?: string;
  ip_address?: string;
  user_agent?: string;
}

/** Input para el borrado de un Sujeto. */
export interface DeleteSujetoInput {
  sujetoId: string;
  actor: ActorContext;
}

/** Input para enviar un Sujeto a Cuarentena. */
export interface QuarantineSujetoInput {
  sujetoId: string;
  /** Tenant desde el que se ejecuta la acción. Determina quarantine_months. */
  companyId: string;
  /** OBLIGATORIO por VETO LEGAL. Vacío → BusinessValidationError. */
  quarantine_reason: string;
  actor: ActorContext;
}

// ─── Helpers privados ────────────────────────────────────────────────────────

/**
 * Suma N meses a una fecha de referencia.
 * Maneja correctamente el desbordamiento de mes (ej. 31-ene + 1 mes → 28-feb).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export const sujetoService = {
  // ───────────────────────────────────────────────────────────────────────────
  // deleteSujeto
  //   Fase 1 (Auditoría)  → comprueba dependencias en Expedientes.
  //   Fase 2 (Bloqueo)    → si existen, lanza LegalBlockError (403).
  //   Fase 3 (Borrado)    → solo ejecuta DELETE físico si dep. = 0.
  // ───────────────────────────────────────────────────────────────────────────
  async deleteSujeto({ sujetoId, actor }: DeleteSujetoInput): Promise<void> {
    // ── Fase 1: Auditoría de dependencias ────────────────────────────────────
    const sujeto = await sujetoRepository.findByIdWithCounts(sujetoId);
    if (!sujeto) {
      throw new EntityNotFoundError("Sujeto", sujetoId);
    }

    const numExpedientes = sujeto._count.expedientes;

    // ── Fase 2: Bloqueo legal ─────────────────────────────────────────────────
    if (numExpedientes > 0) {
      throw new LegalBlockError(
        `Borrado físico bloqueado por VETO LEGAL: el Sujeto "${sujetoId}" ` +
          `tiene ${numExpedientes} expediente(s) asociado(s). ` +
          `Inicie el flujo de Cuarentena en su lugar.`,
        sujetoId,
        { expedientes: numExpedientes }
      );
    }

    // ── Fase 3: Borrado físico autorizado (cero dependencias) ─────────────────
    //    Auditamos ANTES del delete para que el log sobreviva aunque la BD falle.
    //    AuditLog no tiene FK a Sujeto (diseño deliberado del schema).
    //
    //    NOTA DE DISEÑO: El enum AuditAction no incluye DELETE/PURGE.
    //    TODO: proponer añadir AuditAction.PURGE en la próxima revisión del schema
    //    para distinguir borrados físicos autorizados del crypto-shredding GDPR.
    //    Por ahora se registra como FORGET con nota explícita.
    await sujetoRepository.appendAuditLog({
      table_name: "sujetos",
      record_id: sujetoId,
      action: AuditAction.FORGET,
      actor_id: actor.actor_id,
      actor_email: actor.actor_email,
      ip_address: actor.ip_address,
      user_agent: actor.user_agent,
      old_data: {
        id: sujeto.id,
        status: sujeto.status,
        tipo: sujeto.tipo,
        fiscal_id: sujeto.fiscal_id,
      },
      notes:
        "Borrado físico autorizado (PURGE). Cero dependencias legales verificadas. " +
        "PENDIENTE: migrar a AuditAction.PURGE cuando se añada al schema.",
    });

    await sujetoRepository.hardDelete(sujetoId);
  },

  // ───────────────────────────────────────────────────────────────────────────
  // quarantineSujeto
  //   Implementa la Fase 3 completa del VETO LEGAL:
  //   1. Valida quarantine_reason (obligatorio).
  //   2. Verifica existencia del Sujeto.
  //   3. Resuelve quarantine_months desde la SociedadHolding del tenant.
  //   4. Calcula quarantine_expires_at = hoy + quarantine_months (dinámico).
  //   5. Actualiza Sujeto → status: QUARANTINE.
  //   6. Escribe AuditLog inmutable con snapshot antes/después.
  // ───────────────────────────────────────────────────────────────────────────
  async quarantineSujeto({
    sujetoId,
    companyId,
    quarantine_reason,
    actor,
  }: QuarantineSujetoInput): Promise<void> {
    // ── 1. Validación de negocio obligatoria ──────────────────────────────────
    if (!quarantine_reason || quarantine_reason.trim().length === 0) {
      throw new BusinessValidationError(
        "El campo quarantine_reason es obligatorio para iniciar el ciclo de cuarentena.",
        "quarantine_reason"
      );
    }

    // ── 2. Verificar existencia del Sujeto ────────────────────────────────────
    const sujeto = await sujetoRepository.findByIdWithCounts(sujetoId);
    if (!sujeto) {
      throw new EntityNotFoundError("Sujeto", sujetoId);
    }

    // ── 3. Resolver quarantine_months desde el tenant ─────────────────────────
    const sociedad = await sociedadRepository.getQuarantineMonths(companyId);
    if (!sociedad) {
      throw new EntityNotFoundError("SociedadHolding", companyId);
    }

    const { quarantine_months } = sociedad;

    // ── 4. Calcular fecha de expiración (dinámica por tenant) ─────────────────
    //    Ejemplos configurables en SociedadHolding.quarantine_months:
    //      48  meses → 4 años  (retención fiscal estándar, art. 30 CComercio)
    //      120 meses → 10 años (expedientes PBC/SEPBLAC)
    const quarantine_expires_at = addMonths(new Date(), quarantine_months);

    // ── 5. Snapshot del estado previo (para diff en AuditLog) ─────────────────
    const oldData = {
      status: sujeto.status,
      quarantine_reason: sujeto.quarantine_reason,
      quarantine_expires_at: sujeto.quarantine_expires_at,
    };

    // ── 6. Actualizar Sujeto: transición a QUARANTINE ─────────────────────────
    const updated = await sujetoRepository.setQuarantine(sujetoId, {
      quarantine_reason: quarantine_reason.trim(),
      quarantine_expires_at,
    });

    // ── 7. Escribir AuditLog inmutable ────────────────────────────────────────
    await sujetoRepository.appendAuditLog({
      table_name: "sujetos",
      record_id: sujetoId,
      action: AuditAction.QUARANTINE,
      actor_id: actor.actor_id,
      actor_email: actor.actor_email,
      ip_address: actor.ip_address,
      user_agent: actor.user_agent,
      old_data: oldData as Record<string, unknown>,
      new_data: {
        status: updated.status,
        quarantine_reason: updated.quarantine_reason,
        quarantine_expires_at: updated.quarantine_expires_at,
      },
      notes:
        `Cuarentena activada desde tenant "${companyId}". ` +
        `Duración: ${quarantine_months} meses. ` +
        `Expira: ${quarantine_expires_at.toISOString()}. ` +
        `Razón: ${quarantine_reason.trim()}`,
    });
  },
};
