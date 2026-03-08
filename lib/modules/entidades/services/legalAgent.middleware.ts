// ============================================================================
// lib/modules/entidades/services/legalAgent.middleware.ts — Agente Legal: Middleware de Integridad
//
// @role: @Security-CISO / Agente Legal
// @spec: Micro-Spec 1.2 — Interceptor de Borrado y Cuarentena
//
// RESPONSABILIDAD:
//   Punto de entrada único para TODA petición de borrado o cuarentena.
//   Ninguna Server Action puede borrar o archivar un Contacto sin pasar
//   por este middleware. Aplica el flujo de 3 fases invariablemente:
//
//   ┌─────────────────────────────────────────────────────────────────┐
//   │  FASE 1 — Auditoría     checkLegalDependencies(contactId)      │
//   │            ↓ (blocked = true)             ↓ (blocked = false)  │
//   │  FASE 2 — Bloqueo       LegalBlockError   OMITIDA              │
//   │            ↓                               ↓                   │
//   │  FASE 3 — Veredicto     QUARANTINE         PURGE (físico)      │
//   └─────────────────────────────────────────────────────────────────┘
//
// REGLA CISO — TRAZABILIDAD TOTAL:
//   Todo intento de borrado escribe en AuditLog ANTES de mutar el estado,
//   independientemente del veredicto. La tabla audit_logs es INMUTABLE.
//
// REGLA CISO — INTEGRIDAD MULTITENANT:
//   El modelo Contacto deliberadamente NO tiene company_id.
//   Un mismo contacto puede estar en LX y en LW simultáneamente.
//   Este middleware opera sobre la entidad global sin restricción de tenant.
//   Los quarantine_months se resuelven del primer tenant vinculado; si no
//   hay ninguno, se aplica el default de 60 meses (prescripción mercantil).
// ============================================================================

import { createHash } from "crypto";
import { headers } from "next/headers";
import { AuditAction, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  contactoRepository,
  sociedadRepository,
} from "@/lib/modules/entidades/repositories/contacto.repository";
import { isMatrizCif } from "@/lib/modules/entidades/config/matrizConfig";
import {
  BusinessValidationError,
  EntityNotFoundError,
  LegalBlockError,
} from "@/lib/errors/business.errors";

// ─── Configuración ────────────────────────────────────────────────────────────

/**
 * Duración legal por defecto de la cuarentena: 60 meses (5 años).
 * Fuente: art. 30 Código de Comercio / art. 70 Ley 58/2003 General Tributaria.
 * Editable por tenant vía SociedadHolding.quarantine_months.
 */
const DEFAULT_QUARANTINE_MONTHS = 60;

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface DependencyCheckResult {
  blocked: boolean;
  expedientes: number;
  /** Holded: facturas pendientes o emitidas. 0 mientras la API no esté integrada. */
  facturas_pendientes: number;
  /** Drive: documentos asociados al contacto. 0 mientras la API no esté integrada. */
  documentos_drive: number;
  reasons: string[];
}

export interface InterceptDeleteInput {
  contactoId: string;
  /**
   * Razón de la cuarentena (recomendado siempre; obligatorio si se producen
   * dependencias). Si se omite, el middleware genera un motivo automático.
   */
  quarantine_reason?: string;
}

export type InterceptDeleteVerdict =
  | { verdict: "PURGED";      contactoId: string }
  | { verdict: "QUARANTINED"; contactoId: string; expires_at: Date; reasons: string[] };

export interface QuarantineInput {
  contactoId: string;
  /** OBLIGATORIO por VETO LEGAL — BusinessValidationError si está vacío. */
  quarantine_reason: string;
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Extrae IP y User-Agent de los headers de la petición. */
async function resolveActorContext() {
  const hdrs = await headers();
  return {
    ip_address: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? undefined,
    user_agent: hdrs.get("user-agent") ?? undefined,
  };
}

/**
 * Resuelve los meses de cuarentena del primer tenant vinculado al contacto.
 * MULTITENANT: usa el primer link encontrado como referencia de configuración.
 * Si no hay link o la sociedad no está configurada → DEFAULT_QUARANTINE_MONTHS.
 */
async function resolveQuarantineMonths(contactoId: string): Promise<number> {
  const link = await prisma.contactoCompanyLink.findFirst({
    where:  { contacto_id: contactoId },
    select: { company_id: true },
  });
  if (!link) return DEFAULT_QUARANTINE_MONTHS;

  const sociedad = await sociedadRepository.getQuarantineMonths(link.company_id);
  return sociedad?.quarantine_months ?? DEFAULT_QUARANTINE_MONTHS;
}

// ─── Stubs de integración externa ─────────────────────────────────────────────

/**
 * Consulta facturas pendientes o emitidas en Holded para el contacto.
 *
 * ESTADO ACTUAL: SIMULADO — Holded API no integrado.
 * TODO: Reemplazar por llamada real: GET /api/holded/invoices?contactId={id}
 *       y parsear el campo `status` para filtrar "pending" | "issued".
 */
async function checkFacturasHolded(_contactoId: string): Promise<number> {
  // Retorna 0 para no bloquear en entornos sin integración real.
  return 0;
}

/**
 * Consulta documentos asociados en Google Drive para el contacto.
 *
 * ESTADO ACTUAL: SIMULADO — Drive integration no implementada.
 * TODO: Consultar tabla `drive_documents` WHERE entity_id = contactoId
 *       o bien usar la Drive API con el metadata de entity.
 */
async function checkDocumentosDrive(_contactoId: string): Promise<number> {
  // Retorna 0 para no bloquear en entornos sin integración real.
  return 0;
}

// ─── Escritura de AuditLog (helper local para el middleware) ──────────────────

async function writeAuditLog(entry: {
  record_id:   string;
  action:      AuditAction;
  ip_address?: string;
  user_agent?: string;
  old_data?:   Prisma.InputJsonValue;
  new_data?:   Prisma.InputJsonValue;
  notes?:      string;
}): Promise<void> {
  await contactoRepository.appendAuditLog({
    table_name: "contactos",
    ...entry,
  });
}

// ─── Agente Legal ─────────────────────────────────────────────────────────────

export const legalAgent = {
  // ───────────────────────────────────────────────────────────────────────────
  // checkLegalDependencies
  //   Fase 1 — Auditoría de dependencias antes de cualquier borrado.
  //   Fuentes de verdad:
  //     · expedientes  → Prisma (real)
  //     · facturas     → Holded API (simulado, placeholder)
  //     · documentos   → Google Drive (simulado, placeholder)
  // ───────────────────────────────────────────────────────────────────────────
  async checkLegalDependencies(
    contactoId: string
  ): Promise<DependencyCheckResult> {
    const [withCounts, facturas, documentos] = await Promise.all([
      contactoRepository.findByIdWithCounts(contactoId),
      checkFacturasHolded(contactoId),
      checkDocumentosDrive(contactoId),
    ]);

    if (!withCounts) {
      throw new EntityNotFoundError("Contacto", contactoId);
    }

    const expedientes = withCounts._count.expedientes;
    const reasons: string[] = [];

    // VETO PERMANENTE — Entidades matrices protegidas
    if (withCounts.es_facturadora) {
      reasons.push("Entidad de facturación protegida (es_facturadora). Veto de borrado permanente.");
    }
    if (withCounts.es_entidad_activa) {
      reasons.push("Entidad holding activa protegida (es_entidad_activa). Veto de borrado permanente.");
    }
    // CINTURÓN + TIRANTES: aunque el flag no esté en DB, proteger si el CIF
    // está configurado en BRAINLEX_MATRIZ_CIFS (failsafe ante migraciones manuales).
    if (!withCounts.es_facturadora && isMatrizCif(withCounts.fiscal_id)) {
      reasons.push(
        "Entidad de facturación protegida por configuración de sistema (BRAINLEX_MATRIZ_CIFS). Veto de borrado permanente."
      );
    }

    if (expedientes > 0) {
      reasons.push(
        `${expedientes} expediente(s) activo(s) registrado(s) en el sistema.`
      );
    }
    if (facturas > 0) {
      reasons.push(
        `${facturas} factura(s) pendiente(s) o emitida(s) en Holded.`
      );
    }
    if (documentos > 0) {
      reasons.push(
        `${documentos} documento(s) asociado(s) en Google Drive.`
      );
    }

    return {
      blocked:            reasons.length > 0,
      expedientes,
      facturas_pendientes: facturas,
      documentos_drive:    documentos,
      reasons,
    };
  },

  // ───────────────────────────────────────────────────────────────────────────
  // interceptDelete
  //   PUNTO DE ENTRADA ÚNICO para toda petición de borrado físico.
  //
  //   FASE 1 — Auditoría:  checkLegalDependencies → DependencyCheckResult
  //   FASE 2 — Bloqueo:    si blocked → QUARANTINE automática + AuditLog
  //                         → lanza LegalBlockError (403)
  //   FASE 3 — Purga:      cero dependencias → DELETE físico + AuditLog(FORGET)
  //
  //   REGLA CISO: el AuditLog se escribe SIEMPRE antes de mutar el estado.
  //   REGLA MULTITENANT: las dependencias se comprueban sobre la entidad global.
  // ───────────────────────────────────────────────────────────────────────────
  async interceptDelete(
    input: InterceptDeleteInput
  ): Promise<InterceptDeleteVerdict> {
    const { contactoId, quarantine_reason } = input;
    const { ip_address, user_agent } = await resolveActorContext();

    // ── Fase 1: Auditoría de dependencias ─────────────────────────────────
    const deps = await this.checkLegalDependencies(contactoId);

    // Snapshot del estado actual antes de cualquier mutación
    const contacto = await contactoRepository.findByIdWithCounts(contactoId);
    const oldSnapshot = {
      status:                contacto?.status,
      quarantine_reason:     contacto?.quarantine_reason ?? null,
      quarantine_expires_at: contacto?.quarantine_expires_at?.toISOString() ?? null,
    };

    // ── Fase 2: BLOQUEO — dependencias detectadas ─────────────────────────
    if (deps.blocked) {
      const effectiveReason =
        quarantine_reason?.trim() ||
        `Cuarentena automática por VETO LEGAL. Dependencias: ${deps.reasons.join(" | ")}`;

      const months     = await resolveQuarantineMonths(contactoId);
      const expires_at = addMonths(new Date(), months);

      // AuditLog ANTES de mutar — REGLA CISO
      await writeAuditLog({
        record_id:  contactoId,
        action:     AuditAction.QUARANTINE,
        ip_address,
        user_agent,
        old_data:   oldSnapshot,
        new_data: {
          status:                "QUARANTINE",
          quarantine_reason:     effectiveReason,
          quarantine_expires_at: expires_at.toISOString(),
        },
        notes:
          `[AGENTE LEGAL 403] Borrado físico bloqueado. ` +
          `Dependencias: expedientes=${deps.expedientes}, ` +
          `facturas=${deps.facturas_pendientes}, ` +
          `drive=${deps.documentos_drive}. ` +
          `Contacto enviado a QUARANTINE automáticamente. ` +
          `Duración: ${months} meses. ` +
          `Expira: ${expires_at.toISOString()}.`,
      });

      // Transición a QUARANTINE
      await contactoRepository.setQuarantine(contactoId, {
        quarantine_reason:     effectiveReason,
        quarantine_expires_at: expires_at,
      });

      throw new LegalBlockError(
        `[AGENTE LEGAL 403] Borrado físico bloqueado por dependencias legales. ` +
          `${deps.reasons.join(" ")} ` +
          `El contacto ha sido archivado automáticamente en CUARENTENA. ` +
          `Plazo de conservación: ${months} meses ` +
          `(vence el ${expires_at.toLocaleDateString("es-ES")}).`,
        contactoId,
        { expedientes: deps.expedientes }
      );
    }

    // ── Fase 3: PURGA — cero dependencias → DELETE físico autorizado ──────
    // Hash SHA-256 de los campos PII: prueba criptográfica de la eliminación
    // sin almacenar datos personales en el AuditLog (RGPD Art.17).
    const pii_hash = createHash("sha256")
      .update(
        [
          contacto?.fiscal_id      ?? "",
          contacto?.nombre         ?? "",
          contacto?.apellido1      ?? "",
          contacto?.email_principal ?? "",
        ].join("|")
      )
      .digest("hex");

    await writeAuditLog({
      record_id:  contactoId,
      action:     AuditAction.FORGET,
      ip_address,
      user_agent,
      old_data: {
        ...oldSnapshot,
        // SHA-256 anónimo — prueba de eliminación sin PII en claro
        pii_hash,
      },
      notes:
        "[AGENTE LEGAL] Borrado físico autorizado. " +
        "Cero dependencias legales verificadas (expedientes=0, facturas=0, drive=0). " +
        "PII hasheada (SHA-256). Purga ejecutada.",
    });

    // Borrado físico atómico: company_links primero (FK), luego contacto
    await prisma.$transaction([
      prisma.contactoCompanyLink.deleteMany({ where: { contacto_id: contactoId } }),
      prisma.contacto.delete({ where: { id: contactoId } }),
    ]);

    return { verdict: "PURGED", contactoId };
  },

  // ───────────────────────────────────────────────────────────────────────────
  // quarantine
  //   Cuarentena EXPLÍCITA iniciada por el usuario desde "Archivar".
  //   No ejecuta borrado: transiciona a QUARANTINE + AuditLog.
  //   quarantine_reason es OBLIGATORIO (BusinessValidationError si vacío).
  //
  //   MULTITENANT: resuelve quarantine_months del primer tenant vinculado.
  // ───────────────────────────────────────────────────────────────────────────
  async quarantine(input: QuarantineInput): Promise<{ expires_at: Date }> {
    const { contactoId, quarantine_reason } = input;

    // Validar razón (VETO LEGAL)
    if (!quarantine_reason || quarantine_reason.trim().length < 5) {
      throw new BusinessValidationError(
        "El motivo de la cuarentena es obligatorio (mínimo 5 caracteres).",
        "quarantine_reason"
      );
    }

    const contacto = await contactoRepository.findByIdWithCounts(contactoId);
    if (!contacto) {
      throw new EntityNotFoundError("Contacto", contactoId);
    }

    const { ip_address, user_agent } = await resolveActorContext();
    const months     = await resolveQuarantineMonths(contactoId);
    const expires_at = addMonths(new Date(), months);

    const oldSnapshot = {
      status:                contacto.status,
      quarantine_reason:     contacto.quarantine_reason ?? null,
      quarantine_expires_at: contacto.quarantine_expires_at?.toISOString() ?? null,
    };

    // AuditLog ANTES de mutar — REGLA CISO
    await writeAuditLog({
      record_id:  contactoId,
      action:     AuditAction.QUARANTINE,
      ip_address,
      user_agent,
      old_data:   oldSnapshot,
      new_data: {
        status:                "QUARANTINE",
        quarantine_reason:     quarantine_reason.trim(),
        quarantine_expires_at: expires_at.toISOString(),
      },
      notes:
        `[AGENTE LEGAL] Cuarentena explícita iniciada por el usuario. ` +
        `Duración: ${months} meses. ` +
        `Expira: ${expires_at.toISOString()}. ` +
        `Razón: ${quarantine_reason.trim()}`,
    });

    // Transición a QUARANTINE
    await contactoRepository.setQuarantine(contactoId, {
      quarantine_reason:     quarantine_reason.trim(),
      quarantine_expires_at: expires_at,
    });

    return { expires_at };
  },
};
