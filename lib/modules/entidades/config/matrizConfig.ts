// ============================================================================
// lib/config/matrizConfig.ts — Configuración de Entidades Matrices
//
// @role: @Data-Architect / @Security-CISO
// @spec: Universal — agnóstico de cliente
//
// PROPÓSITO:
//   Permite identificar "Entidades Matrices" (facturadoras / holdings) mediante
//   la variable de entorno BRAINLEX_MATRIZ_CIFS, sin hardcodear nombres ni IDs
//   en el código fuente. Cualquier contacto cuyo fiscal_id aparezca en esta
//   lista recibirá automáticamente `es_facturadora = true` en create/update
//   y estará protegido por el veto de borrado permanente del Agente Legal.
//
// CONFIGURACIÓN (.env.local / variables de entorno del servidor):
//   BRAINLEX_MATRIZ_CIFS=B12345678,A98765432
//   (lista separada por comas; mayúsculas/minúsculas ignoradas)
//
// NOTA DE SEGURIDAD:
//   Esta variable es SERVER-ONLY (sin prefijo NEXT_PUBLIC_).
//   Nunca exponer al cliente.
// ============================================================================

const raw = process.env.BRAINLEX_MATRIZ_CIFS ?? "";

/**
 * Conjunto inmutable de CIFs/NIFs configurados como Entidades Matrices.
 * Calculado una sola vez al arrancar el servidor (module-level singleton).
 */
export const MATRIZ_CIFS: ReadonlySet<string> = new Set(
  raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

/**
 * Devuelve true si el fiscal_id dado pertenece a una Entidad Matriz
 * configurada vía BRAINLEX_MATRIZ_CIFS.
 *
 * @param fiscalId - El fiscal_id a comprobar (puede ser null/undefined).
 */
export function isMatrizCif(fiscalId: string | null | undefined): boolean {
  if (!fiscalId) return false;
  return MATRIZ_CIFS.has(fiscalId.trim().toUpperCase());
}
