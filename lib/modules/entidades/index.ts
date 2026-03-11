// ============================================================================
// lib/modules/entidades/index.ts — Barrel de Módulo: Entidades
//
// Re-exporta los contratos públicos del módulo de Entidades para uso externo.
//
// IMPORTANTE: Las Server Actions ("use server") NO se re-exportan aquí porque
// Next.js 15 requiere que sean importadas directamente desde su archivo de
// origen — los proxies de re-exportación rompen el bundler de Server Actions.
//
// Para usar las acciones, importar directamente:
//   import { createContacto } from "@/lib/modules/entidades/actions/contactos.actions"
//   import { crearDireccion } from "@/lib/modules/entidades/actions/filiacion.actions"
//   import { requestForgotten } from "@/lib/modules/entidades/actions/rgpd.actions"
// ============================================================================

// ─── Repositorio ──────────────────────────────────────────────────────────────
export { contactoRepository, sociedadRepository } from "./repositories/contacto.repository";

// ─── Servicios ────────────────────────────────────────────────────────────────
export { contactoService } from "./services/contacto.service";

// ─── Validaciones (tipos + schemas Zod) ───────────────────────────────────────
export type {
  CreateContactoInput,
  UpdateContactoInput,
  ContactoFieldErrors,
} from "./validations/contacto.schema";
export { ContactoFormSchema } from "./validations/contacto.schema";

// ─── Config ───────────────────────────────────────────────────────────────────
export { isMatrizCif } from "./config/matrizConfig";

// ─── Motor de Clasificación Multidimensional (SALI + Grafo) ───────────────────
export {
  categoriaEtiquetaRepository,
  etiquetaRepository,
  etiquetaAsignadaRepository,
} from "./repositories/etiqueta.repository";
export type {
  EntidadTipo,
  EtiquetaConCategoria,
  CategoriaConEtiquetas,
} from "./repositories/etiqueta.repository";

export {
  tipoRelacionRepository,
  relacionRepository,
} from "./repositories/relacion.repository";
export type { RelacionCompleta } from "./repositories/relacion.repository";

// Acciones — importar directamente por restricción Next.js 15:
//   import { getCategorias, createEtiqueta, ... } from "@/lib/modules/entidades/actions/etiquetas.actions"
//   import { getTiposRelacion, createRelacion, ... } from "@/lib/modules/entidades/actions/relaciones.actions"
