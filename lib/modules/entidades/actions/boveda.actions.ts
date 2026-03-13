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

// ─── Tipos ──────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getCarpetasTree(contactoId: string): Promise<CarpetaNode[]> {
  const carpetas = await carpetaRepository.findByContacto(contactoId);

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
): Promise<ActionResult<{ id: string }>> {
  if (!nombre.trim()) {
    return { ok: false, error: "El nombre de la carpeta es obligatorio." };
  }

  // Si tiene padre, verificar que el padre no sea blueprint
  if (parentId) {
    const parent = await carpetaRepository.findById(parentId);
    if (!parent) return { ok: false, error: "La carpeta padre no existe." };
    if (parent.es_blueprint) {
      return { ok: false, error: "No se pueden crear subcarpetas dentro de una carpeta de blueprint." };
    }
  }

  const carpeta = await carpetaRepository.createDirect({
    nombre: nombre.trim(),
    tipo: "MANUAL",
    contacto_id: contactoId,
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

  // No permitir mover dentro de una carpeta blueprint
  if (newParentId) {
    const target = await carpetaRepository.findById(newParentId);
    if (!target) return { ok: false, error: "La carpeta destino no existe." };
    if (target.es_blueprint) {
      return { ok: false, error: "No se pueden mover carpetas dentro de una carpeta de blueprint." };
    }
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
