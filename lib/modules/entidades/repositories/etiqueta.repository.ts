// ============================================================================
// lib/modules/entidades/repositories/etiqueta.repository.ts
//
// @role: @Data-Architect / @Doc-Specialist
// @spec: Motor de Clasificación Multidimensional — Sistema SALI
//
// Acceso a datos para CategoriaEtiqueta, Etiqueta y EtiquetaAsignada.
// CERO lógica de negocio. Solo operaciones atómicas contra Prisma.
// ============================================================================

import { prisma } from "@/lib/prisma";
import type {
  CategoriaEtiqueta,
  Etiqueta,
  EtiquetaAsignada,
  EtiquetaScope,
  Prisma,
} from "@prisma/client";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type EntidadTipo = "CONTACTO" | "EXPEDIENTE" | "DOCUMENTO" | "TAREA";

export type EtiquetaConCategoria = Etiqueta & {
  categoria: CategoriaEtiqueta;
};

export type CategoriaConEtiquetas = CategoriaEtiqueta & {
  etiquetas: Etiqueta[];
};

// ─── Categorías ───────────────────────────────────────────────────────────────

export const categoriaEtiquetaRepository = {
  /** Todas las categorías ordenadas por `orden` ASC, con sus etiquetas activas. */
  async findAll(): Promise<CategoriaConEtiquetas[]> {
    return prisma.categoriaEtiqueta.findMany({
      orderBy: { orden: "asc" },
      include: { etiquetas: { where: { activo: true }, orderBy: { nombre: "asc" } } },
    });
  },

  /** Todas las categorías con TODAS las etiquetas (incluidas archivadas). Para admin. */
  async findAllWithArchived(): Promise<CategoriaConEtiquetas[]> {
    return prisma.categoriaEtiqueta.findMany({
      orderBy: { orden: "asc" },
      include: { etiquetas: { orderBy: { nombre: "asc" } } },
    });
  },

  async findById(id: string): Promise<CategoriaConEtiquetas | null> {
    return prisma.categoriaEtiqueta.findUnique({
      where: { id },
      include: { etiquetas: { where: { activo: true }, orderBy: { nombre: "asc" } } },
    });
  },

  async create(data: Prisma.CategoriaEtiquetaCreateInput): Promise<CategoriaEtiqueta> {
    return prisma.categoriaEtiqueta.create({ data });
  },

  async update(id: string, data: Prisma.CategoriaEtiquetaUpdateInput): Promise<CategoriaEtiqueta> {
    return prisma.categoriaEtiqueta.update({ where: { id }, data });
  },

  /** Solo se puede borrar si no tiene etiquetas vinculadas. La capa de acción lo verifica. */
  async delete(id: string): Promise<void> {
    await prisma.categoriaEtiqueta.delete({ where: { id } });
  },

  async count(): Promise<number> {
    return prisma.categoriaEtiqueta.count();
  },
};

// ─── Etiquetas ────────────────────────────────────────────────────────────────

export const etiquetaRepository = {
  /** Etiquetas activas con su categoría. */
  async findAll(): Promise<EtiquetaConCategoria[]> {
    return prisma.etiqueta.findMany({
      where: { activo: true },
      orderBy: [{ categoria_id: "asc" }, { nombre: "asc" }],
      include: { categoria: true },
    });
  },

  /**
   * @Scope-Guard + @Security-CISO — Devuelve etiquetas ACTIVAS visibles para un tenant/rol.
   *
   * Regla Scope:    activo=true AND (scope == GLOBAL || scope == tenantScope)
   * Regla CISO:     si isSuperAdmin=false, excluye solo_super_admin=true (Prisma-level)
   * Regla Herencia: si isSuperAdmin=false, excluye Servicios cuyo parent es solo_super_admin=true
   * Bypass CEO:     si isSuperAdmin=true, devuelve todos los scopes y todas las restricciones.
   */
  async findByTenant(
    tenantScope: EtiquetaScope,
    isSuperAdmin = false
  ): Promise<EtiquetaConCategoria[]> {
    const where: Prisma.EtiquetaWhereInput = isSuperAdmin
      ? { activo: true }
      : {
          activo: true,
          scope: { in: ["GLOBAL", tenantScope] },
          solo_super_admin: false,
          // Herencia: excluir servicios cuyo departamento padre es restringido
          OR: [
            { parent_id: null }, // Sin padre → no hereda restricción
            { parent: { solo_super_admin: false } }, // Padre público → visible
          ],
        };

    return prisma.etiqueta.findMany({
      where,
      orderBy: [{ categoria_id: "asc" }, { nombre: "asc" }],
      include: { categoria: true, parent: { select: { id: true, nombre: true } } },
    });
  },

  async findByCategoria(categoriaId: string): Promise<Etiqueta[]> {
    return prisma.etiqueta.findMany({
      where: { categoria_id: categoriaId, activo: true },
      orderBy: { nombre: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.etiqueta.findUnique({
      where: { id },
      include: { categoria: true, parent: { select: { id: true, nombre: true } } },
    });
  },

  async create(data: Prisma.EtiquetaCreateInput): Promise<Etiqueta> {
    return prisma.etiqueta.create({ data });
  },

  async update(id: string, data: Prisma.EtiquetaUpdateInput): Promise<Etiqueta> {
    return prisma.etiqueta.update({ where: { id }, data });
  },

  /** Cuenta asignaciones ACTIVAS (fecha_desvinculacion=null) de una etiqueta. */
  async countUsages(id: string): Promise<number> {
    return prisma.etiquetaAsignada.count({
      where: { etiqueta_id: id, fecha_desvinculacion: null },
    });
  },

  /** Soft-delete: marca activo=false. Preserva vínculos históricos. */
  async archive(id: string): Promise<Etiqueta> {
    return prisma.etiqueta.update({ where: { id }, data: { activo: false } });
  },

  /** Borrado físico. Solo usar cuando no tiene asignaciones. */
  async delete(id: string): Promise<void> {
    await prisma.etiqueta.delete({ where: { id } });
  },

  /**
   * Libera todas las etiquetas de contenido: es_sistema → false.
   * Solo las CategoriaEtiqueta (5 cajones) son inmutables por diseño.
   * Retorna el número de registros actualizados.
   */
  async bulkClearSistema(): Promise<number> {
    const result = await prisma.etiqueta.updateMany({
      where: { es_sistema: true },
      data: { es_sistema: false },
    });
    return result.count;
  },
};

// ─── Asignaciones (polimórficas) ──────────────────────────────────────────────

export const etiquetaAsignadaRepository = {
  /** Devuelve las etiquetas ACTIVAS asignadas a una entidad concreta.
   *  Solo registros con fecha_desvinculacion=null (no soft-deleted). */
  async findByEntidad(
    entidad_id: string,
    entidad_tipo: EntidadTipo
  ) {
    return prisma.etiquetaAsignada.findMany({
      where: { entidad_id, entidad_tipo, fecha_desvinculacion: null },
      include: { etiqueta: { include: { categoria: true, parent: { select: { id: true, nombre: true } } } } },
      orderBy: { fecha_asignacion: "asc" },
    });
  },

  /** Asigna una etiqueta a una entidad. Idempotente (@@unique garantiza sin duplicados).
   *  Si el registro existía con fecha_desvinculacion (soft-deleted), lo reactiva. */
  async assign(
    etiqueta_id: string,
    entidad_id: string,
    entidad_tipo: EntidadTipo,
    asignado_por?: string
  ): Promise<EtiquetaAsignada> {
    return prisma.etiquetaAsignada.upsert({
      where: {
        etiqueta_id_entidad_id_entidad_tipo: { etiqueta_id, entidad_id, entidad_tipo },
      },
      create: { etiqueta_id, entidad_id, entidad_tipo, asignado_por },
      update: { fecha_desvinculacion: null, asignado_por },
    });
  },

  /**
   * @Time-Keeper — Soft-unassign: marca fecha_desvinculacion en lugar de borrar.
   * Preserva el historial temporal de asignaciones para auditoría.
   */
  async unassign(
    etiqueta_id: string,
    entidad_id: string,
    entidad_tipo: EntidadTipo
  ): Promise<void> {
    await prisma.etiquetaAsignada.updateMany({
      where:  { etiqueta_id, entidad_id, entidad_tipo, fecha_desvinculacion: null },
      data:   { fecha_desvinculacion: new Date() },
    });
  },

  /**
   * Filtro de intersección: devuelve los IDs de entidades que tienen
   * TODAS las etiquetas especificadas (AND semántico).
   *
   * Uso en TAREA 3: se combina con findContactosByFilter en contacto.repository.
   */
  async findEntidadesConTodasLasEtiquetas(
    etiqueta_ids: string[],
    entidad_tipo: EntidadTipo
  ): Promise<string[]> {
    if (etiqueta_ids.length === 0) return [];

    // Para cada etiqueta, obtenemos el set de entidades que la tienen.
    // La intersección es el conjunto de entidades presentes en TODOS los sets.
    const sets = await Promise.all(
      etiqueta_ids.map((id) =>
        prisma.etiquetaAsignada
          .findMany({ where: { etiqueta_id: id, entidad_tipo }, select: { entidad_id: true } })
          .then((rows: { entidad_id: string }[]) => new Set(rows.map((r) => r.entidad_id)))
      )
    );

    if (sets.length === 0) return [];

    const [first, ...rest] = sets;
    const intersection = [...first].filter((id) => rest.every((s: Set<string>) => s.has(id)));
    return intersection;
  },
};
