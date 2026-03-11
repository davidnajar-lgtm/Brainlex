// ============================================================================
// lib/config/categoriaTipos.ts — Tipología de Cajones SALI
//
// Define qué categorías son "Constructores" (crean estructura en Drive)
// y cuáles son "Atributos" (solo metadatos vinculados al contacto).
//
// @Scope-Guard: esta configuración es independiente del tenant.
// ============================================================================

export type CategoriaTipo = "CONSTRUCTOR" | "ATRIBUTO";

/**
 * Mapa de nombres de categoría → tipo.
 * Las claves deben coincidir EXACTAMENTE con los nombres de CategoriaEtiqueta en seed.
 */
const CATEGORIA_TIPO_MAP: Record<string, CategoriaTipo> = {
  Departamento:  "CONSTRUCTOR",
  Servicio:      "CONSTRUCTOR",
  Identidad:     "ATRIBUTO",
  Estado:        "ATRIBUTO",
  Inteligencia:  "ATRIBUTO",
};

/**
 * Devuelve el tipo de una categoría a partir de su nombre.
 * Default: ATRIBUTO (conservador — no dispara acciones en Drive sin confirmación).
 */
export function getCategoriaTipo(nombreCategoria: string): CategoriaTipo {
  return CATEGORIA_TIPO_MAP[nombreCategoria] ?? "ATRIBUTO";
}

/**
 * True si la categoría es de tipo Constructor (genera carpeta en Drive).
 */
export function isConstructor(nombreCategoria: string): boolean {
  return getCategoriaTipo(nombreCategoria) === "CONSTRUCTOR";
}
