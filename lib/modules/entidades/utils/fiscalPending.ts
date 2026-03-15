// ============================================================================
// lib/modules/entidades/utils/fiscalPending.ts — Detección de datos fiscales pendientes
//
// @role: @Data-Architect
// @spec: Fase 9.03 — Alta Rápida con SIN_REGISTRO
//
// FUNCIÓN PURA: sin efectos secundarios, sin imports pesados.
// Usable tanto en server como en client.
// ============================================================================

/**
 * Determina si un contacto tiene datos fiscales pendientes.
 * Un contacto es "fiscal pending" cuando:
 *   - fiscal_id_tipo es SIN_REGISTRO o null
 *   - fiscal_id está vacío o null
 *
 * Esto significa que el contacto NO es apto para facturación oficial
 * pero SÍ puede operar en el sistema (relaciones, expedientes, etc.).
 */
export function isFiscalPending(
  fiscalIdTipo: string | null | undefined,
  fiscalId: string | null | undefined,
): boolean {
  if (!fiscalIdTipo || fiscalIdTipo === "SIN_REGISTRO") return true;
  if (!fiscalId || !fiscalId.trim()) return true;
  return false;
}
