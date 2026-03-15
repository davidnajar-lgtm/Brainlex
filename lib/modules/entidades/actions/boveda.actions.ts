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
import { syncFolderToGoogleDrive, syncSingleFolderToGoogleDrive } from "@/lib/services/driveIntegration.service";
import { auditLogRepository } from "../repositories/auditLog.repository";
import { ensureDocPermanente } from "@/lib/services/docPermanente.service";

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
  // Asegurar que existe la carpeta DocPermanente (idempotente, best-effort)
  await ensureDocPermanente(contactoId).catch(() => {});

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

    // REGLA CISO — Protección multitenant: padre debe pertenecer al mismo tenant
    if (companyId && parent.company_id && parent.company_id !== companyId) {
      return {
        ok: false,
        error: `La carpeta padre pertenece a ${parent.company_id}. No se puede crear dentro desde ${companyId}.`,
      };
    }
  }

  const carpeta = await carpetaRepository.createDirect({
    nombre: nombre.trim(),
    tipo: "MANUAL",
    contacto_id: contactoId,
    company_id: companyId ?? null,
    parent_id: parentId ?? null,
  });

  // REGLA CISO — AuditLog
  await auditLogRepository.append({
    table_name: "Carpeta",
    record_id: carpeta.id,
    action: "CREATE",
    notes: `Carpeta manual "${nombre.trim()}" creada para contacto ${contactoId}`,
  });

  // Drive sync (best-effort — no bloquea si falla)
  syncSingleFolderToGoogleDrive(nombre.trim()).catch(() => {});

  revalidatePath(`/contactos/${contactoId}`);
  return { ok: true, data: { id: carpeta.id } };
}

// ─── Mover carpeta ──────────────────────────────────────────────────────────

/**
 * @Scope-Guard — Mover carpeta con protección multitenant.
 * Un tenant NO puede mover carpetas que pertenecen a otro tenant.
 */
export async function moveCarpeta(
  carpetaId: string,
  newParentId: string | null,
  orden: number,
  companyId?: string | null,
): Promise<ActionResult> {
  const carpeta = await carpetaRepository.findById(carpetaId);
  if (!carpeta) return { ok: false, error: "Carpeta no encontrada." };

  // Blueprint inmutable: no se puede mover
  if (carpeta.es_blueprint) {
    return { ok: false, error: "Las carpetas de blueprint son inmutables y no se pueden mover." };
  }

  // REGLA CISO — Protección multitenant
  if (companyId && carpeta.company_id && carpeta.company_id !== companyId) {
    return {
      ok: false,
      error: `Esta carpeta pertenece a ${carpeta.company_id}. No se puede mover desde ${companyId}.`,
    };
  }

  // Verificar que el destino existe (se permite mover dentro de blueprint)
  if (newParentId) {
    const target = await carpetaRepository.findById(newParentId);
    if (!target) return { ok: false, error: "La carpeta destino no existe." };
  }

  // REGLA CISO — AuditLog ANTES de mutar
  await auditLogRepository.append({
    table_name: "Carpeta",
    record_id: carpetaId,
    action: "UPDATE",
    notes: `Carpeta "${carpeta.nombre}" movida a parent=${newParentId ?? "raíz"}, orden=${orden}`,
  });

  await carpetaRepository.move(carpetaId, newParentId, orden);
  revalidatePath(`/contactos/${carpeta.contacto_id}`);
  return { ok: true, data: undefined };
}

// ─── Borrar carpeta ─────────────────────────────────────────────────────────

/**
 * @Scope-Guard — Borrado de carpeta con protección multitenant.
 *
 * REGLA CISO — INTEGRIDAD MULTITENANT:
 *   Si la carpeta tiene company_id asignado y se proporciona companyId,
 *   verifica que la carpeta pertenece al tenant que solicita el borrado.
 *   Un tenant NO puede borrar carpetas de otro tenant.
 *
 *   Carpetas con company_id=null (preexistentes) son accesibles por todos
 *   los tenants. Su borrado requiere companyId=null (SuperAdmin).
 */
export async function deleteCarpeta(
  carpetaId: string,
  companyId?: string | null,
): Promise<ActionResult> {
  const carpeta = await carpetaRepository.findById(carpetaId);
  if (!carpeta) return { ok: false, error: "Carpeta no encontrada." };

  if (carpeta.es_blueprint) {
    return { ok: false, error: "Las carpetas de blueprint son inmutables y no se pueden borrar." };
  }

  // REGLA CISO — Protección multitenant: solo el tenant propietario puede borrar
  if (companyId && carpeta.company_id && carpeta.company_id !== companyId) {
    return {
      ok: false,
      error: `Esta carpeta pertenece a ${carpeta.company_id}. No se puede borrar desde ${companyId}.`,
    };
  }

  // REGLA CISO — AuditLog ANTES de mutar
  await auditLogRepository.append({
    table_name: "Carpeta",
    record_id: carpetaId,
    action: "FORGET",
    notes: `Carpeta "${carpeta.nombre}" eliminada del contacto ${carpeta.contacto_id}`,
  });

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
      periodicidad: etiqueta.periodicidad ?? "PUNTUAL",
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

    // 3b. Si ANUAL, crear carpeta de año entre servicio y subcarpetas
    let subcarpetaParentId = rootCarpeta.id;
    if (plan.yearFolder) {
      const yearCarpeta = await carpetaRepository.createDirect({
        nombre: plan.yearFolder,
        tipo: "INTELIGENTE",
        contacto_id: contactoId,
        company_id: companyId,
        parent_id: rootCarpeta.id,
        etiqueta_id: null,
        es_blueprint: true,
        orden: 0,
      });
      createdIds.push(yearCarpeta.id);
      subcarpetaParentId = yearCarpeta.id;
    }

    // 4. Crear subcarpetas blueprint (solo para Servicio)
    for (let i = 0; i < plan.subcarpetas.length; i++) {
      const sub = await carpetaRepository.createDirect({
        nombre: plan.subcarpetas[i],
        tipo: "INTELIGENTE",
        contacto_id: contactoId,
        company_id: companyId,
        parent_id: subcarpetaParentId,
        etiqueta_id: null,
        es_blueprint: true,
        orden: i + 1,
      });
      createdIds.push(sub.id);
    }

    // REGLA CISO — AuditLog para materialización
    await auditLogRepository.append({
      table_name: "Carpeta",
      record_id: rootCarpeta.id,
      action: "CREATE",
      notes: `Blueprint materializado: "${etiqueta.nombre}" (${createdIds.length} carpetas) para contacto ${contactoId}`,
    });

    // Drive sync (best-effort — BD ya tiene las carpetas, Drive es idempotente)
    const segments = [etiqueta.nombre];
    if (plan.yearFolder) segments.push(plan.yearFolder);
    for (const sub of plan.subcarpetas) {
      syncFolderToGoogleDrive(etiqueta.nombre, [...segments.slice(1), sub]).catch(() => {});
    }
    if (plan.subcarpetas.length === 0) {
      syncFolderToGoogleDrive(etiqueta.nombre, segments.slice(1)).catch(() => {});
    }

    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: { carpetaIds: createdIds } };
  } catch (err) {
    console.error("[materializeBlueprintCarpetas] Error:", err);
    return { ok: false, error: "Error al materializar carpetas del blueprint" };
  }
}

// ─── Mover archivo ──────────────────────────────────────────────────────────

/**
 * @Scope-Guard — Mover archivo con protección multitenant.
 *
 * REGLA CISO — INTEGRIDAD MULTITENANT:
 *   1. El archivo (vía su carpeta origen) debe pertenecer al tenant solicitante.
 *   2. La carpeta destino debe pertenecer al mismo tenant.
 *   Un tenant NO puede mover archivos a carpetas de otro tenant.
 */
export async function moveArchivo(
  archivoId: string,
  targetCarpetaId: string,
  contactoId: string,
  companyId?: string | null,
): Promise<ActionResult> {
  // Verificar que el archivo existe y obtener su carpeta origen
  const archivo = await archivoRepository.findById(archivoId);
  if (!archivo) return { ok: false, error: "El archivo no existe." };

  // Verificar que el destino existe
  const target = await carpetaRepository.findById(targetCarpetaId);
  if (!target) return { ok: false, error: "La carpeta destino no existe." };

  // REGLA CISO — Protección multitenant: validar carpeta origen
  if (companyId && archivo.carpeta.company_id && archivo.carpeta.company_id !== companyId) {
    return {
      ok: false,
      error: `El archivo pertenece a ${archivo.carpeta.company_id}. No se puede mover desde ${companyId}.`,
    };
  }

  // REGLA CISO — Protección multitenant: validar carpeta destino
  if (companyId && target.company_id && target.company_id !== companyId) {
    return {
      ok: false,
      error: `La carpeta destino pertenece a ${target.company_id}. No se puede mover desde ${companyId}.`,
    };
  }

  // REGLA CISO — AuditLog ANTES de mutar
  await auditLogRepository.append({
    table_name: "Archivo",
    record_id: archivoId,
    action: "UPDATE",
    notes: `Archivo "${archivo.nombre}" movido de carpeta ${archivo.carpeta.id} a ${targetCarpetaId}`,
  });

  await archivoRepository.move(archivoId, targetCarpetaId);
  revalidatePath(`/contactos/${contactoId}`);
  return { ok: true, data: undefined };
}
