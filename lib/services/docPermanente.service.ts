// ============================================================================
// lib/services/docPermanente.service.ts — Carpeta Documentación Permanente
//
// @role: @Integration-Broker
// @spec: FASE 12.02 — Repositorio Unificado de Identidad
//
// Asegura que cada contacto tenga una carpeta raíz "00_DOCUMENTACION_PERMANENTE"
// en su bóveda. Esta carpeta es GLOBAL (company_id=null), inmutable (blueprint),
// y siempre aparece primera (orden=-1).
//
// Contenido típico: NIF, Escrituras, Poderes, DNI/Pasaporte.
// Los archivos subidos aquí se replican automáticamente al contacto espejo
// si existe en otro tenant (Mirror-Service).
// ============================================================================

import { carpetaRepository } from "@/lib/modules/entidades/repositories/boveda.repository";
import { auditLogRepository } from "@/lib/modules/entidades/repositories/auditLog.repository";

// ─── Constantes ─────────────────────────────────────────────────────────────

import { DOC_PERMANENTE_NOMBRE } from "./docPermanente.constants";
export { DOC_PERMANENTE_NOMBRE };

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Asegura que el contacto tenga la carpeta "00_DOCUMENTACION_PERMANENTE".
 * Idempotente: no crea si ya existe en raíz.
 *
 * @returns ID de la carpeta (existente o recién creada), o null si error.
 */
export async function ensureDocPermanente(contactoId: string): Promise<string | null> {
  try {
    // 1. Buscar si ya existe en raíz (company_id=null para visibilidad global)
    const existing = await carpetaRepository.findByContacto(contactoId, null);
    const docPerm = existing.find(
      (c) => c.nombre === DOC_PERMANENTE_NOMBRE && c.parent_id === null,
    );

    if (docPerm) return docPerm.id;

    // 2. Crear carpeta DocPermanente
    const carpeta = await carpetaRepository.createDirect({
      nombre: DOC_PERMANENTE_NOMBRE,
      tipo: "INTELIGENTE",
      contacto_id: contactoId,
      company_id: null,   // GLOBAL — visible por todos los tenants
      parent_id: null,    // Siempre raíz
      etiqueta_id: null,
      es_blueprint: true, // Inmutable — no se puede borrar ni mover
      orden: -1,          // Siempre primero en el árbol
    });

    // AuditLog
    await auditLogRepository.append({
      table_name: "Carpeta",
      record_id: carpeta.id,
      action: "CREATE",
      notes: `Carpeta DocPermanente creada automáticamente para contacto ${contactoId}`,
    });

    return carpeta.id;
  } catch (err) {
    console.error("[DocPermanente] Error ensuring folder:", err);
    return null;
  }
}

/**
 * Verifica si una carpeta es la carpeta de Documentación Permanente.
 */
export function isDocPermanente(carpetaNombre: string): boolean {
  return carpetaNombre === DOC_PERMANENTE_NOMBRE;
}
