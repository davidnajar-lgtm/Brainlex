// ============================================================================
// lib/modules/entidades/actions/boveda.actions.ts
//
// @role: @Doc-Specialist
// @spec: Visor de Bóveda — Server Actions para Carpeta y Archivo
//
// Acciones:
//   - getCarpetasTree:       obtiene árbol de carpetas de un contacto
//   - createCarpetaManual:   crea carpeta libre (MANUAL)
//   - moveCarpeta:           mueve carpeta (valida blueprint)
//   - deleteCarpeta:         borra carpeta (valida blueprint)
//   - moveArchivo:           mueve archivo entre carpetas
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { carpetaRepository, archivoRepository } from "../repositories/boveda.repository";
import { buildCarpetaTree, type CarpetaFlat, type CarpetaNode } from "@/lib/services/bovedaTree.service";
import { planBlueprintCarpetas, scopeToCompanyId } from "@/lib/services/blueprintMaterialize.service";
import { etiquetaRepository } from "../repositories/etiqueta.repository";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * @Scope-Guard — filtra carpetas por tenant.
 * companyId "LX"/"LW" → solo carpetas de ese tenant + globales.
 * null → SuperAdmin, ve todas.
 */
export async function getCarpetasTree(contactoId: string, companyId?: string | null): Promise<CarpetaNode[]> {
  const carpetas = await carpetaRepository.findByContacto(contactoId, companyId);

  const flat: CarpetaFlat[] = carpetas.map((c) => ({
    id:           c.id,
    nombre:       c.nombre,
    tipo:         c.tipo as "INTELIGENTE" | "MANUAL",
    contacto_id:  c.contacto_id,
    parent_id:    c.parent_id,
    etiqueta_id:  c.etiqueta_id,
    es_blueprint: c.es_blueprint,
    orden:        c.orden,
    archivos:     c.archivos.map((a) => ({
      id:         a.id,
      nombre:     a.nombre,
      mime_type:  a.mime_type,
      size_bytes: a.size_bytes,
    })),
  }));

  return buildCarpetaTree(flat);
}

// ─── Crear carpeta manual ───────────────────────────────────────────────────

export async function createCarpetaManual(
  contactoId: string,
  nombre: string,
  parentId?: string | null,
  companyId?: string | null,
): Promise<ActionResult<{ id: string }>> {
  if (!nombre.trim()) {
    return { ok: false, error: "El nombre de la carpeta es obligatorio." };
  }

  // Verificar que el padre existe (se permite crear dentro de blueprint)
  if (parentId) {
    const parent = await carpetaRepository.findById(parentId);
    if (!parent) return { ok: false, error: "La carpeta padre no existe." };
  }

  const carpeta = await carpetaRepository.createDirect({
    nombre: nombre.trim(),
    tipo: "MANUAL",
    contacto_id: contactoId,
    company_id: companyId ?? null,
    parent_id: parentId ?? null,
  });

  revalidatePath(`/contactos/${contactoId}`);
  return { ok: true, data: { id: carpeta.id } };
}

// ─── Mover carpeta ──────────────────────────────────────────────────────────

export async function moveCarpeta(
  carpetaId: string,
  newParentId: string | null,
  orden: number,
): Promise<ActionResult> {
  const carpeta = await carpetaRepository.findById(carpetaId);
  if (!carpeta) return { ok: false, error: "Carpeta no encontrada." };

  // Blueprint inmutable: no se puede mover
  if (carpeta.es_blueprint) {
    return { ok: false, error: "Las carpetas de blueprint son inmutables y no se pueden mover." };
  }

  // Verificar que el destino existe (se permite mover dentro de blueprint)
  if (newParentId) {
    const target = await carpetaRepository.findById(newParentId);
    if (!target) return { ok: false, error: "La carpeta destino no existe." };
  }

  await carpetaRepository.move(carpetaId, newParentId, orden);
  revalidatePath(`/contactos/${carpeta.contacto_id}`);
  return { ok: true, data: undefined };
}

// ─── Borrar carpeta ─────────────────────────────────────────────────────────

export async function deleteCarpeta(carpetaId: string): Promise<ActionResult> {
  const carpeta = await carpetaRepository.findById(carpetaId);
  if (!carpeta) return { ok: false, error: "Carpeta no encontrada." };

  if (carpeta.es_blueprint) {
    return { ok: false, error: "Las carpetas de blueprint son inmutables y no se pueden borrar." };
  }

  await carpetaRepository.delete(carpetaId);
  revalidatePath(`/contactos/${carpeta.contacto_id}`);
  return { ok: true, data: undefined };
}

// ─── Materializar Blueprint ─────────────────────────────────────────────────

/**
 * Materializa carpetas INTELIGENTE en BD cuando se asigna un Constructor.
 *
 * - Departamento → 1 carpeta raíz INTELIGENTE
 * - Servicio → 1 carpeta INTELIGENTE + N subcarpetas es_blueprint=true
 * - Idempotente: no crea si ya existe carpeta con esa etiqueta_id
 * - Resuelve scope de la etiqueta → company_id para visibilidad tenant
 *
 * @returns IDs de carpetas creadas (vacío si skip)
 */
export async function materializeBlueprintCarpetas(
  contactoId: string,
  etiquetaId: string,
): Promise<ActionResult<{ carpetaIds: string[] }>> {
  try {
    // 0. Obtener datos completos de la etiqueta (nombre, categoría, blueprint, parent)
    const etiqueta = await etiquetaRepository.findById(etiquetaId);
    if (!etiqueta || !etiqueta.categoria) {
      return { ok: true, data: { carpetaIds: [] } };
    }

    const categoriaNombre = etiqueta.categoria.nombre;
    const blueprint = Array.isArray(etiqueta.blueprint) ? etiqueta.blueprint as string[] : null;

    // Resolver scope → company_id para tenant visibility
    const companyId = scopeToCompanyId(etiqueta.scope);

    // 1. Obtener carpetas INTELIGENTE existentes para idempotencia
    const existing = await carpetaRepository.findByContactoWithEtiquetas(contactoId);
    const existingIds = new Set(existing.map((c) => c.etiqueta_id!));
    const existingMap = new Map(existing.map((c) => [c.etiqueta_id!, c.id]));

    // 2. Generar plan (función pura)
    const plan = planBlueprintCarpetas({
      etiquetaId,
      etiquetaNombre: etiqueta.nombre,
      categoriaNombre,
      blueprint,
      parentEtiquetaId: etiqueta.parent_id ?? null,
      existingCarpetaEtiquetaIds: existingIds,
      existingCarpetasByEtiqueta: existingMap,
    });

    if (plan.skip || !plan.rootCarpeta) {
      return { ok: true, data: { carpetaIds: [] } };
    }

    const createdIds: string[] = [];

    // 3. Crear carpeta raíz del Constructor
    const rootCarpeta = await carpetaRepository.createDirect({
      nombre: plan.rootCarpeta.nombre,
      tipo: "INTELIGENTE",
      contacto_id: contactoId,
      company_id: companyId,
      parent_id: plan.rootCarpeta.parentCarpetaId,
      etiqueta_id: plan.rootCarpeta.etiqueta_id,
      es_blueprint: false,
      orden: 0,
    });
    createdIds.push(rootCarpeta.id);

    // 4. Crear subcarpetas blueprint (solo para Servicio)
    for (let i = 0; i < plan.subcarpetas.length; i++) {
      const sub = await carpetaRepository.createDirect({
        nombre: plan.subcarpetas[i],
        tipo: "INTELIGENTE",
        contacto_id: contactoId,
        company_id: companyId,
        parent_id: rootCarpeta.id,
        etiqueta_id: null,
        es_blueprint: true,
        orden: i + 1,
      });
      createdIds.push(sub.id);
    }

    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: { carpetaIds: createdIds } };
  } catch (err) {
    console.error("[materializeBlueprintCarpetas] Error:", err);
    return { ok: false, error: "Error al materializar carpetas del blueprint" };
  }
}

// ─── Mover archivo ──────────────────────────────────────────────────────────

export async function moveArchivo(
  archivoId: string,
  targetCarpetaId: string,
  contactoId: string,
): Promise<ActionResult> {
  // Verificar que el destino no es blueprint
  const target = await carpetaRepository.findById(targetCarpetaId);
  if (!target) return { ok: false, error: "La carpeta destino no existe." };

  await archivoRepository.move(archivoId, targetCarpetaId);
  revalidatePath(`/contactos/${contactoId}`);
  return { ok: true, data: undefined };
}
