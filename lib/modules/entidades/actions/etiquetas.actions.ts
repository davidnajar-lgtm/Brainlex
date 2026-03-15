"use server";

// ============================================================================
// lib/modules/entidades/actions/etiquetas.actions.ts
//
// @role: @Data-Architect / @Doc-Specialist
// @spec: Motor de Clasificación Multidimensional — Sistema SALI
//
// Server Actions para gestión de CategoriaEtiqueta, Etiqueta y EtiquetaAsignada.
// Solo Admin puede crear/editar/borrar categorías y etiquetas.
// Cualquier usuario autenticado puede asignar etiquetas existentes.
// ============================================================================

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  categoriaEtiquetaRepository,
  etiquetaRepository,
  etiquetaAsignadaRepository,
  type EntidadTipo,
} from "@/lib/modules/entidades/repositories/etiqueta.repository";
import { contactoRepository } from "@/lib/modules/entidades/repositories/contacto.repository";
import type { EtiquetaScope } from "@prisma/client";

// ─── 5 cajones SALI — HARD-CODED, INAMOVIBLE ───────────────────────────────
// ANTES de cualquier función que los use. No mover.

const CAJONES_SALI = new Set(["Identidad", "Departamento", "Servicio", "Estado", "Inteligencia"]);
const CAJON_ORDER = ["Identidad", "Departamento", "Servicio", "Estado", "Inteligencia"];

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const CategoriaSchema = z.object({
  nombre:      z.string().min(1).max(80),
  descripcion: z.string().max(300).optional(),
  orden:       z.number().int().min(0).default(0),
});

const EtiquetaSchema = z.object({
  nombre:        z.string().min(1).max(80),
  color:         z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido").default("#6b7280"),
  categoria_id:  z.string().cuid(),
  parent_id:     z.string().cuid().nullable().optional(),
  es_expediente: z.boolean().optional().default(false),
});

// ─── Tipos de retorno ─────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ─── Categorías ───────────────────────────────────────────────────────────────

export async function getCategorias() {
  try {
    const all = await categoriaEtiquetaRepository.findAll();
    // PURGA SALI: Solo las 5 categorías válidas
    const data = all.filter((c) => CAJONES_SALI.has(c.nombre));
    return { ok: true, data } as const;
  } catch (e) {
    console.error("[getCategorias] Error:", e);
    return { ok: false, error: "Error al cargar categorías" } as const;
  }
}

export async function createCategoria(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const parsed = CategoriaSchema.safeParse({
    nombre:      formData.get("nombre"),
    descripcion: formData.get("descripcion") || undefined,
    orden:       Number(formData.get("orden") ?? 0),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const cat = await categoriaEtiquetaRepository.create(parsed.data);
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: { id: cat.id } };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ya existe una categoría con ese nombre" };
    }
    return { ok: false, error: "Error al crear la categoría" };
  }
}

export async function updateCategoria(
  id: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const parsed = CategoriaSchema.safeParse({
    nombre:      formData.get("nombre"),
    descripcion: formData.get("descripcion") || undefined,
    orden:       Number(formData.get("orden") ?? 0),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await categoriaEtiquetaRepository.update(id, parsed.data);
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar la categoría" };
  }
}

export async function deleteCategoria(id: string): Promise<ActionResult> {
  const cat = await categoriaEtiquetaRepository.findById(id);
  if (!cat) return { ok: false, error: "Categoría no encontrada" };
  if (cat.etiquetas.length > 0) {
    return {
      ok: false,
      error: `No se puede borrar: tiene ${cat.etiquetas.length} etiqueta(s) vinculada(s). Borra primero las etiquetas.`,
    };
  }
  try {
    await categoriaEtiquetaRepository.delete(id);
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al borrar la categoría" };
  }
}

// ─── Etiquetas ────────────────────────────────────────────────────────────────

export async function createEtiqueta(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const parsed = EtiquetaSchema.safeParse({
    nombre:        formData.get("nombre"),
    color:         formData.get("color") ?? "#6b7280",
    categoria_id:  formData.get("categoria_id"),
    parent_id:     formData.get("parent_id") || null,
    es_expediente: formData.get("es_expediente") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const createData: Parameters<typeof etiquetaRepository.create>[0] = {
      nombre:        parsed.data.nombre,
      color:         parsed.data.color,
      es_expediente: parsed.data.es_expediente ?? false,
      categoria:     { connect: { id: parsed.data.categoria_id } },
    };
    if (parsed.data.parent_id) {
      createData.parent = { connect: { id: parsed.data.parent_id } };
    }
    const etiqueta = await etiquetaRepository.create(createData);
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: { id: etiqueta.id } };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ya existe una etiqueta con ese nombre en esta categoría" };
    }
    return { ok: false, error: "Error al crear la etiqueta" };
  }
}

export async function updateEtiqueta(
  id: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const parsed = EtiquetaSchema.partial().safeParse({
    nombre: formData.get("nombre") || undefined,
    color:  formData.get("color")  || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const etiqueta = await etiquetaRepository.findById(id);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  if (etiqueta.es_sistema) return { ok: false, error: "Las etiquetas de sistema no son editables" };
  try {
    await etiquetaRepository.update(id, parsed.data);
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar la etiqueta" };
  }
}

/**
 * Cuenta las asignaciones activas de una etiqueta.
 * Usado por la UI para decidir candado vs papelera.
 */
export async function getEtiquetaUsageCount(id: string): Promise<ActionResult<number>> {
  try {
    const count = await etiquetaRepository.countUsages(id);
    return { ok: true, data: count };
  } catch {
    return { ok: false, error: "Error al contar usos" };
  }
}

/**
 * Borrado inteligente de etiqueta:
 * - Si tiene 0 asignaciones activas → borrado físico (DELETE)
 * - Si tiene asignaciones activas → soft-delete (activo=false)
 *
 * La UI debe llamar primero a getEtiquetaUsageCount para mostrar
 * candado vs papelera y el diálogo de confirmación adecuado.
 */
export async function deleteEtiqueta(id: string): Promise<ActionResult<{ archived: boolean }>> {
  const etiqueta = await etiquetaRepository.findById(id);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  if (etiqueta.es_sistema) return { ok: false, error: "Las etiquetas de sistema no se pueden borrar" };

  try {
    const usages = await etiquetaRepository.countUsages(id);

    if (usages === 0) {
      // Sin vínculos — borrado físico seguro
      await etiquetaRepository.delete(id);
      revalidatePath("/admin/taxonomia");
      return { ok: true, data: { archived: false } };
    }

    // Tiene vínculos — soft-delete: ocultar del catálogo, preservar historial
    await etiquetaRepository.archive(id);
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: { archived: true } };
  } catch {
    return { ok: false, error: "Error al eliminar la etiqueta" };
  }
}

/**
 * Actualiza el parent_id de una etiqueta (Servicio → Departamento).
 * Solo Admin. Las etiquetas de sistema no son editables.
 */
export async function updateEtiquetaParent(
  etiquetaId: string,
  parentId: string
): Promise<ActionResult> {
  const etiqueta = await etiquetaRepository.findById(etiquetaId);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  if (etiqueta.es_sistema) return { ok: false, error: "Las etiquetas de sistema no son editables" };
  try {
    await etiquetaRepository.update(etiquetaId, { parent: { connect: { id: parentId } } });
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar el departamento padre" };
  }
}

/**
 * Actualiza el flag es_expediente de una etiqueta (Servicio).
 * Solo Admin. Las etiquetas de sistema no son editables.
 */
export async function updateEtiquetaExpediente(
  etiquetaId: string,
  esExpediente: boolean
): Promise<ActionResult> {
  const etiqueta = await etiquetaRepository.findById(etiquetaId);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  if (etiqueta.es_sistema) return { ok: false, error: "Las etiquetas de sistema no son editables" };
  try {
    await etiquetaRepository.update(etiquetaId, { es_expediente: esExpediente });
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar es_expediente" };
  }
}

/**
 * @Security-CISO — Marca una etiqueta Constructor como confidencial.
 * Solo SuperAdmin. Las etiquetas marcadas son INVISIBLES para Staff.
 */
export async function updateEtiquetaSoloSuperAdmin(
  etiquetaId: string,
  soloSuperAdmin: boolean
): Promise<ActionResult> {
  const etiqueta = await etiquetaRepository.findById(etiquetaId);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  try {
    await etiquetaRepository.update(etiquetaId, { solo_super_admin: soloSuperAdmin });
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar restricción de seguridad" };
  }
}

/**
 * Actualiza la periodicidad de un Servicio: "PUNTUAL" | "ANUAL".
 * Solo Admin. Las etiquetas de sistema no son editables.
 */
export async function updateEtiquetaPeriodicidad(
  etiquetaId: string,
  periodicidad: string
): Promise<ActionResult> {
  if (periodicidad !== "PUNTUAL" && periodicidad !== "ANUAL") {
    return { ok: false, error: "Periodicidad inválida. Valores permitidos: PUNTUAL, ANUAL." };
  }
  const etiqueta = await etiquetaRepository.findById(etiquetaId);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  if (etiqueta.es_sistema) return { ok: false, error: "Las etiquetas de sistema no son editables" };
  try {
    await etiquetaRepository.update(etiquetaId, { periodicidad });
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar la periodicidad" };
  }
}

/**
 * Restaura una etiqueta archivada (activo=false → activo=true).
 * Solo Admin. Permite recuperar etiquetas que fueron soft-deleted.
 */
export async function restoreEtiqueta(id: string): Promise<ActionResult> {
  const etiqueta = await etiquetaRepository.findById(id);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  if (etiqueta.activo) return { ok: false, error: "La etiqueta ya está activa" };
  try {
    await etiquetaRepository.update(id, { activo: true });
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al restaurar la etiqueta" };
  }
}

/**
 * Libera todas las etiquetas de contenido: pone es_sistema=false.
 * Solo las 5 CategoriaEtiqueta son inmutables (hardcoded CAJONES_SALI).
 * Las etiquetas individuales deben ser editables/borrables por el CEO.
 * Idempotente — se puede llamar múltiples veces sin efecto.
 */
export async function liberateContentTags(): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await etiquetaRepository.bulkClearSistema();
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: { updated: result } };
  } catch {
    return { ok: false, error: "Error al liberar etiquetas de sistema" };
  }
}

/**
 * Devuelve las categorías con TODAS las etiquetas (incluidas archivadas).
 * Solo para admin — modo ghost de recuperación.
 */
export async function getCategoriasWithArchived() {
  try {
    const all = await categoriaEtiquetaRepository.findAllWithArchived();
    const data = all.filter((c) => CAJONES_SALI.has(c.nombre));
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar categorías con archivadas" } as const;
  }
}

// ─── Scope ───────────────────────────────────────────────────────────────────

const VALID_SCOPES = new Set(["GLOBAL", "LEXCONOMY", "LAWTECH"]);

/**
 * @Scope-Guard — Actualiza la visibilidad (scope) de una etiqueta.
 * Solo Admin. Las etiquetas de sistema no pueden cambiar de scope.
 */
export async function updateEtiquetaScope(
  etiquetaId: string,
  scope: string
): Promise<ActionResult> {
  if (!VALID_SCOPES.has(scope)) {
    return { ok: false, error: `Scope inválido: ${scope}. Valores válidos: GLOBAL, LEXCONOMY, LAWTECH` };
  }
  const etiqueta = await etiquetaRepository.findById(etiquetaId);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };
  if (etiqueta.es_sistema) return { ok: false, error: "Las etiquetas de sistema no pueden cambiar de scope" };

  try {
    await etiquetaRepository.update(etiquetaId, { scope: scope as "GLOBAL" | "LEXCONOMY" | "LAWTECH" });
    revalidatePath("/admin/taxonomia");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar el scope" };
  }
}

// ─── Blueprints ──────────────────────────────────────────────────────────────

/**
 * Actualiza el blueprint (estructura de subcarpetas) de una etiqueta Constructor.
 * Solo Admin. El blueprint es un array de strings representando nombres de subcarpetas.
 * Ejemplo: ["Documentación", "Presupuestos", "Facturación", "Correspondencia"]
 */
export async function updateBlueprint(
  etiquetaId: string,
  blueprint: string[]
): Promise<ActionResult> {
  const etiqueta = await etiquetaRepository.findById(etiquetaId);
  if (!etiqueta) return { ok: false, error: "Etiqueta no encontrada" };

  try {
    await etiquetaRepository.update(etiquetaId, { blueprint });
    // No revalidatePath aquí — el cliente recarga manualmente via reloadCategorias
    // para evitar race condition entre RSC refetch y estado local
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al guardar el blueprint" };
  }
}

/**
 * Devuelve una etiqueta por ID con su blueprint (para el editor).
 */
export async function getEtiquetaConBlueprint(etiquetaId: string) {
  try {
    const data = await etiquetaRepository.findById(etiquetaId);
    if (!data) return { ok: false, error: "Etiqueta no encontrada" } as const;
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar etiqueta" } as const;
  }
}

// ─── Asignaciones ─────────────────────────────────────────────────────────────

export async function getEtiquetasDeEntidad(entidad_id: string, entidad_tipo: EntidadTipo) {
  try {
    const data = await etiquetaAsignadaRepository.findByEntidad(entidad_id, entidad_tipo);
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar etiquetas" } as const;
  }
}

export async function asignarEtiqueta(
  etiqueta_id: string,
  entidad_id: string,
  entidad_tipo: EntidadTipo,
  asignado_por?: string
): Promise<ActionResult> {
  try {
    await etiquetaAsignadaRepository.assign(etiqueta_id, entidad_id, entidad_tipo, asignado_por);

    // REGLA CISO — AuditLog
    if (entidad_tipo === "CONTACTO") {
      const etqInfo = await etiquetaRepository.findById(etiqueta_id);
      await contactoRepository.appendAuditLog({
        table_name: "etiquetas",
        record_id:  entidad_id,
        action:     "UPDATE",
        notes:      `Etiqueta asignada: ${etqInfo?.nombre ?? etiqueta_id}`,
      });
    }

    // ── Blueprint Trigger Detection (Point 0 — Fase 0: solo log) ──────────
    // Detecta si la etiqueta asignada es Constructor o Año temporal.
    // En Fase 4+ esto disparará la creación real de carpetas en Drive.
    if (entidad_tipo === "CONTACTO") {
      try {
        const etiqueta = await etiquetaRepository.findById(etiqueta_id);
        if (etiqueta) {
          const { shouldTriggerBlueprint } = await import("@/lib/services/blueprintTrigger.service");
          const catName = etiqueta.categoria?.nombre ?? "";
          shouldTriggerBlueprint(catName, etiqueta.nombre);
        }
      } catch (triggerErr) {
        // Non-blocking: trigger detection failure must not break assignment
        console.error("[BlueprintTrigger] Error en deteccion:", triggerErr);
      }
    }

    revalidatePath(`/contactos/${entidad_id}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al asignar la etiqueta" };
  }
}

export async function desasignarEtiqueta(
  etiqueta_id: string,
  entidad_id: string,
  entidad_tipo: EntidadTipo
): Promise<ActionResult> {
  try {
    // REGLA CISO — AuditLog ANTES de mutar
    if (entidad_tipo === "CONTACTO") {
      const etqInfo = await etiquetaRepository.findById(etiqueta_id);
      await contactoRepository.appendAuditLog({
        table_name: "etiquetas",
        record_id:  entidad_id,
        action:     "UPDATE",
        notes:      `Etiqueta retirada: ${etqInfo?.nombre ?? etiqueta_id}`,
      });
    }

    await etiquetaAsignadaRepository.unassign(etiqueta_id, entidad_id, entidad_tipo);
    revalidatePath(`/contactos/${entidad_id}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al quitar la etiqueta" };
  }
}

/**
 * @Scope-Guard — Devuelve etiquetas agrupadas por categoría, filtradas por tenant.
 * Si isSuperAdmin=true, devuelve todos los scopes sin filtro (bypass CEO).
 *
 * PURGA SALI: Solo devuelve las 5 categorías válidas. Etiquetas huérfanas de
 * categorías no-SALI se consolidan bajo "Inteligencia".
 */
export async function getEtiquetasByTenant(
  tenantScope: EtiquetaScope,
  isSuperAdmin: boolean
) {
  try {
    const etiquetas = await etiquetaRepository.findByTenant(tenantScope, isSuperAdmin);

    // Agrupar por nombre de categoría SALI (no por ID).
    // Huérfanas (Financiera, Comercial, Procesal...) → "Inteligencia".
    // Clave por NOMBRE garantiza que no hay duplicados.
    const byNombre = etiquetas.reduce<
      Record<string, { id: string; nombre: string; etiquetas: typeof etiquetas }>
    >((acc, e) => {
      const nombre = CAJONES_SALI.has(e.categoria.nombre)
        ? e.categoria.nombre
        : "Inteligencia";
      if (!acc[nombre]) acc[nombre] = { id: e.categoria.id, nombre, etiquetas: [] };
      acc[nombre].etiquetas.push(e);
      return acc;
    }, {});

    // Ordenar por CAJON_ORDER — EXACTAMENTE 5 o menos
    const sorted = CAJON_ORDER
      .filter((name) => byNombre[name])
      .map((name) => byNombre[name]);

    return { ok: true, data: sorted } as const;
  } catch {
    return { ok: false, error: "Error al cargar etiquetas" } as const;
  }
}

// ─── Copiar Estructura de Otro Contacto (Point 3) ──────────────────────────

export type CloneStructureResult =
  | { ok: true; cloned: number; skipped: number }
  | { ok: false; error: string };

/**
 * Copia las etiquetas asignadas del contacto origen al destino.
 * Deduplicación: no clona etiquetas que el destino ya tiene.
 *
 * @Security-CISO (8.12): Aplica exclusión directa + herencia.
 *   - Etiquetas con solo_super_admin=true → invisibles.
 *   - Servicios cuyo Departamento padre es solo_super_admin=true → invisibles.
 */
export async function cloneStructureFromContacto(
  sourceContactoId: string,
  targetContactoId: string,
  isSuperAdmin = false
): Promise<CloneStructureResult> {
  try {
    // 1. Obtener etiquetas activas del origen
    const sourceAssignments = await etiquetaAsignadaRepository.findByEntidad(
      sourceContactoId,
      "CONTACTO"
    );

    if (sourceAssignments.length === 0) {
      return { ok: false, error: "El contacto origen no tiene etiquetas asignadas" };
    }

    // 2. @Security-CISO: exclusión directa + herencia de departamento padre
    let visibleAssignments = sourceAssignments;
    if (!isSuperAdmin) {
      // Primero: IDs de departamentos restringidos
      const restrictedDeptIds = new Set<string>();
      for (const a of sourceAssignments) {
        if (a.etiqueta.categoria?.nombre === "Departamento" && a.etiqueta.solo_super_admin) {
          restrictedDeptIds.add(a.etiqueta_id);
        }
      }
      // Filtrar: exclusión directa + herencia
      visibleAssignments = sourceAssignments.filter((a) => {
        if (a.etiqueta.solo_super_admin) return false;
        if (a.etiqueta.parent_id && restrictedDeptIds.has(a.etiqueta.parent_id)) return false;
        return true;
      });
    }

    if (visibleAssignments.length === 0) {
      return { ok: false, error: "El contacto origen no tiene etiquetas visibles para tu rol" };
    }

    // 3. Obtener etiquetas activas del destino (para deduplicar)
    const targetAssignments = await etiquetaAsignadaRepository.findByEntidad(
      targetContactoId,
      "CONTACTO"
    );
    const targetEtiquetaIds = new Set(targetAssignments.map((a) => a.etiqueta_id));

    // 4. Clonar solo las que no existen en el destino
    let cloned = 0;
    let skipped = 0;

    for (const assignment of visibleAssignments) {
      if (targetEtiquetaIds.has(assignment.etiqueta_id)) {
        skipped++;
        continue;
      }
      await etiquetaAsignadaRepository.assign(
        assignment.etiqueta_id,
        targetContactoId,
        "CONTACTO"
      );
      cloned++;
    }

    revalidatePath(`/contactos/${targetContactoId}`);
    return { ok: true, cloned, skipped };
  } catch {
    return { ok: false, error: "Error al copiar la estructura" };
  }
}
