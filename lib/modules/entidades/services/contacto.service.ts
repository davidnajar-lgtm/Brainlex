// ============================================================================
// lib/modules/entidades/services/contacto.service.ts — Servicio de Dominio: Contacto
//
// @role: Agente Legal (Middleware de Integridad y Cuarentena)
// @spec: Micro-Spec 1.2 — Flujo VETO LEGAL (@security_and_legal.md)
//
// REGLAS INQUEBRANTABLES:
//   1. NUNCA se llama hardDelete si el Contacto tiene expedientes.
//   2. quarantine_reason es SIEMPRE obligatorio.
//   3. quarantine_expires_at se calcula SIEMPRE desde quarantine_months del tenant.
//   4. TODA mutación escribe en AuditLog (inmutable).
// ============================================================================
import { AuditAction } from "@prisma/client";

import {
  BusinessValidationError,
  EntityNotFoundError,
  LegalBlockError,
} from "@/lib/errors/business.errors";
import {
  contactoRepository,
  sociedadRepository,
} from "@/lib/modules/entidades/repositories/contacto.repository";

// ─── Tipos públicos del servicio ─────────────────────────────────────────────

/** Contexto del actor que ejecuta la acción (usuario autenticado o job de sistema). */
export interface ActorContext {
  actor_id?: string;
  actor_email?: string;
  ip_address?: string;
  user_agent?: string;
}

/** Input para el borrado de un Contacto. */
export interface DeleteContactoInput {
  contactoId: string;
  actor: ActorContext;
}

/** Input para enviar un Contacto a Cuarentena. */
export interface QuarantineContactoInput {
  contactoId: string;
  /** Tenant desde el que se ejecuta la acción. Determina quarantine_months. */
  companyId: string;
  /** OBLIGATORIO por VETO LEGAL. Vacío → BusinessValidationError. */
  quarantine_reason: string;
  actor: ActorContext;
}

// ─── Helpers privados ────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export const contactoService = {
  // ───────────────────────────────────────────────────────────────────────────
  // deleteContacto
  //   Fase 1 (Auditoría)  → comprueba dependencias en Expedientes.
  //   Fase 2 (Bloqueo)    → si existen, lanza LegalBlockError (403).
  //   Fase 3 (Borrado)    → solo ejecuta DELETE físico si dep. = 0.
  // ───────────────────────────────────────────────────────────────────────────
  async deleteContacto({ contactoId, actor }: DeleteContactoInput): Promise<void> {
    const contacto = await contactoRepository.findByIdWithCounts(contactoId);
    if (!contacto) {
      throw new EntityNotFoundError("Contacto", contactoId);
    }

    const numExpedientes = contacto._count.expedientes;

    if (numExpedientes > 0) {
      throw new LegalBlockError(
        `Borrado físico bloqueado por VETO LEGAL: el Contacto "${contactoId}" ` +
          `tiene ${numExpedientes} expediente(s) asociado(s). ` +
          `Inicie el flujo de Cuarentena en su lugar.`,
        contactoId,
        { expedientes: numExpedientes }
      );
    }

    await contactoRepository.appendAuditLog({
      table_name: "contactos",
      record_id: contactoId,
      action: AuditAction.FORGET,
      actor_id: actor.actor_id,
      actor_email: actor.actor_email,
      ip_address: actor.ip_address,
      user_agent: actor.user_agent,
      old_data: {
        id: contacto.id,
        status: contacto.status,
        tipo: contacto.tipo,
        fiscal_id: contacto.fiscal_id,
      },
      notes:
        "Borrado físico autorizado (PURGE). Cero dependencias legales verificadas.",
    });

    await contactoRepository.dangerouslyHardDeleteForGdprComplianceOnly(contactoId);
  },

  // ───────────────────────────────────────────────────────────────────────────
  // quarantineContacto
  //   1. Valida quarantine_reason (obligatorio).
  //   2. Verifica existencia del Contacto.
  //   3. Resuelve quarantine_months desde la SociedadHolding del tenant.
  //   4. Calcula quarantine_expires_at = hoy + quarantine_months.
  //   5. Actualiza Contacto → status: QUARANTINE.
  //   6. Escribe AuditLog inmutable con snapshot antes/después.
  // ───────────────────────────────────────────────────────────────────────────
  async quarantineContacto({
    contactoId,
    companyId,
    quarantine_reason,
    actor,
  }: QuarantineContactoInput): Promise<void> {
    if (!quarantine_reason || quarantine_reason.trim().length === 0) {
      throw new BusinessValidationError(
        "El campo quarantine_reason es obligatorio para iniciar el ciclo de cuarentena.",
        "quarantine_reason"
      );
    }

    const contacto = await contactoRepository.findByIdWithCounts(contactoId);
    if (!contacto) {
      throw new EntityNotFoundError("Contacto", contactoId);
    }

    const sociedad = await sociedadRepository.getQuarantineMonths(companyId);
    if (!sociedad) {
      throw new EntityNotFoundError("SociedadHolding", companyId);
    }

    const { quarantine_months } = sociedad;
    const quarantine_expires_at = addMonths(new Date(), quarantine_months);

    const oldData = {
      status: contacto.status,
      quarantine_reason: contacto.quarantine_reason,
      quarantine_expires_at: contacto.quarantine_expires_at?.toISOString() ?? null,
    };

    const updated = await contactoRepository.setQuarantine(contactoId, {
      quarantine_reason: quarantine_reason.trim(),
      quarantine_expires_at,
    });

    await contactoRepository.appendAuditLog({
      table_name: "contactos",
      record_id: contactoId,
      action: AuditAction.QUARANTINE,
      actor_id: actor.actor_id,
      actor_email: actor.actor_email,
      ip_address: actor.ip_address,
      user_agent: actor.user_agent,
      old_data: oldData,
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
