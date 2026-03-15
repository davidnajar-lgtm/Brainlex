// ============================================================================
// lib/utils/dateHelpers.ts — Utilidades de fecha compartidas
// ============================================================================

/**
 * Detecta si un nombre de etiqueta es un año (4 dígitos, rango 2000–2099).
 */
export function isYearTag(nombre: string): boolean {
  return /^\d{4}$/.test(nombre.trim()) && Number(nombre) >= 2000 && Number(nombre) <= 2099;
}
