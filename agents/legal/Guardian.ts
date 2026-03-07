// ============================================================================
// agents/legal/Guardian.ts — Agente Legal: Punto de VETO Hardcoded
//
// @role:   @Security-CISO / Agente Legal
// @spec:   Micro-Spec 1.2 — validateDelete + checkDependencies + quarantine
// @author: Arquitecto Jefe (Project Manager)
//
// RESPONSABILIDAD:
//   Fachada pública del Agente Legal. TODA operación de borrado o archivado
//   sobre la tabla `contactos` DEBE pasar por `Guardian.validateDelete()`.
//   Este veto es INAMOVIBLE: no puede ser desactivado por configuración.
//
// REGLA DE VETO (HARDCODED — NO NEGOCIABLE):
//   1. Si checkDependencies() detecta expedientes, facturas o documentos:
//      → la API ignora la orden de destrucción (no solo oculta el botón)
//      → el registro entra en estado QUARANTINE automáticamente
//      → se registra en AuditLog con acción QUARANTINE
//      → se lanza LegalBlockError (HTTP 403)
//   2. El delete físico SOLO se ejecuta cuando las 3 fuentes arrojan 0.
//   3. El AuditLog se escribe SIEMPRE antes de mutar el estado (CISO).
//
// FLUJO DE 3 FASES (Micro-Spec 1.2):
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │  FASE 1 — Auditoría    checkDependencies(contactoId)            │
//   │            ↓ (blocked)                  ↓ (clean)               │
//   │  FASE 2 — Bloqueo      QUARANTINE        —                      │
//   │            ↓                             ↓                      │
//   │  FASE 3 — Veredicto    LegalBlockError   DELETE físico          │
//   └──────────────────────────────────────────────────────────────────┘
//
// CERTIFICADO DE MÓDULO:
//   Este archivo es el origen canónico del Agente Legal.
//   Versión: 1.0.0 | Fecha: 2026-03-07 | Aprobado: Arquitecto Jefe
// ============================================================================

import {
  legalAgent,
  type DependencyCheckResult,
  type InterceptDeleteVerdict,
  type QuarantineInput,
} from "@/lib/services/legalAgent.middleware";
import { LegalBlockError } from "@/lib/errors/business.errors";
import { DecisionLogger } from "@/agents/shared/DecisionLogger";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface DeleteValidationResult {
  allowed: boolean;
  /** Veredicto PURGED si allowed=true; undefined si blocked */
  verdict?: InterceptDeleteVerdict;
  /** Razones de bloqueo si allowed=false */
  reasons?: string[];
}

export interface GuardianCertificate {
  module: string;
  contactoId: string;
  verdict: "APPROVED" | "BLOCKED";
  timestamp: string;
  reasons: string[];
}

// ─── Guardian — Fachada del Agente Legal ─────────────────────────────────────

export const Guardian = {
  /**
   * VETO HARDCODED — Punto de entrada único para TODA petición de borrado.
   *
   * Delega en `legalAgent.interceptDelete()` (lógica de 3 fases).
   * Si el middleware lanza LegalBlockError → captura y devuelve
   * `{ allowed: false, reasons }` en lugar de propagar la excepción,
   * de modo que la Server Action pueda responder con HTTP 403 limpiamente.
   *
   * REGLA: ninguna Server Action puede llamar a prisma.contacto.delete()
   *        sin haber pasado primero por este método.
   */
  async validateDelete(
    contactoId: string,
    quarantine_reason?: string
  ): Promise<DeleteValidationResult> {
    try {
      const verdict = await legalAgent.interceptDelete({
        contactoId,
        quarantine_reason,
      });

      DecisionLogger.approve("GUARDIAN", "interceptDelete", "contactos",
        `Borrado físico autorizado. Cero dependencias legales verificadas.`,
        contactoId
      );

      return { allowed: true, verdict };
    } catch (err) {
      if (err instanceof LegalBlockError) {
        DecisionLogger.veto("GUARDIAN", "interceptDelete", "contactos",
          `Borrado bloqueado por dependencias legales. ${err.message.slice(0, 120)}`,
          contactoId
        );
        return {
          allowed: false,
          reasons: [err.message],
        };
      }
      // Errores inesperados: re-propagar (no silenciar fallos de infraestructura)
      throw err;
    }
  },

  /**
   * Auditoría de dependencias ANTES de cualquier mutación.
   * Expuesto para que el Frontend pueda preguntar al servidor si el borrado
   * está permitido (p.ej. deshabilitar el botón de borrado con respaldo de API).
   *
   * IMPORTANTE: este método NO muta el estado. Solo informa.
   */
  async checkDependencies(contactoId: string): Promise<DependencyCheckResult> {
    return legalAgent.checkLegalDependencies(contactoId);
  },

  /**
   * Inicia cuarentena explícita (acción "Archivar").
   * quarantine_reason es OBLIGATORIO — mínimo 5 caracteres.
   * Lanza BusinessValidationError si el motivo está vacío.
   */
  async quarantine(input: QuarantineInput): Promise<{ expires_at: Date }> {
    const result = await legalAgent.quarantine(input);
    DecisionLogger.quarantine("GUARDIAN", "contactos",
      `Cuarentena explícita. Motivo: ${input.quarantine_reason.slice(0, 100)}. Expira: ${result.expires_at.toISOString()}.`,
      input.contactoId
    );
    return result;
  },

  /**
   * Emite el certificado de cumplimiento del Agente Legal para un contacto.
   * Usado por el proceso de "Certificado de Módulo" al pasar a producción.
   */
  async issueCertificate(
    module: string,
    contactoId: string
  ): Promise<GuardianCertificate> {
    const deps = await legalAgent.checkLegalDependencies(contactoId);
    const verdict = deps.blocked ? "BLOCKED" : "APPROVED";

    DecisionLogger.certify("GUARDIAN", module,
      verdict === "APPROVED" ? "APPROVED" : "FAILED",
      `Certificado legal. Dependencias: expedientes=${deps.expedientes}, facturas=${deps.facturas_pendientes}, drive=${deps.documentos_drive}.`
    );

    return {
      module,
      contactoId,
      verdict,
      timestamp: new Date().toISOString(),
      reasons: deps.reasons,
    };
  },
} as const;
