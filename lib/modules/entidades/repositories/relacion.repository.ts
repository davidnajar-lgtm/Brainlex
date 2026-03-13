// ============================================================================
// lib/modules/entidades/repositories/relacion.repository.ts
//
// @role: @Data-Architect
// @spec: Motor de Clasificación Multidimensional — Grafo de Relaciones
//
// Acceso a datos para TipoRelacion y Relacion entre Contactos.
// CERO lógica de negocio. Solo operaciones atómicas contra Prisma.
// ============================================================================

import { prisma } from "@/lib/prisma";
import type { Contacto, Prisma, Relacion, TipoRelacion } from "@prisma/client";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type RelacionCompleta = Relacion & {
  tipo_relacion: TipoRelacion;
  origen:        Pick<Contacto, "id" | "nombre" | "apellido1" | "razon_social" | "tipo">;
  destino:       Pick<Contacto, "id" | "nombre" | "apellido1" | "razon_social" | "tipo">;
  /** Campos extendidos de Ecosistema (pueden ser null) */
  cargo?:                string | null;
  departamento_interno?: string | null;
  sede_vinculada_id?:    string | null;
};

// ─── TipoRelacion ─────────────────────────────────────────────────────────────

export const tipoRelacionRepository = {
  async findAll(): Promise<TipoRelacion[]> {
    return prisma.tipoRelacion.findMany({
      orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    });
  },

  async findById(id: string): Promise<TipoRelacion | null> {
    return prisma.tipoRelacion.findUnique({ where: { id } });
  },

  async create(data: Prisma.TipoRelacionCreateInput): Promise<TipoRelacion> {
    return prisma.tipoRelacion.create({ data });
  },

  async update(id: string, data: Prisma.TipoRelacionUpdateInput): Promise<TipoRelacion> {
    return prisma.tipoRelacion.update({ where: { id }, data });
  },

  /** Solo eliminable si es_sistema=false y no tiene relaciones activas. */
  async delete(id: string): Promise<void> {
    await prisma.tipoRelacion.delete({ where: { id } });
  },

  async countRelaciones(id: string): Promise<number> {
    return prisma.relacion.count({ where: { tipo_relacion_id: id } });
  },
};

// ─── Relacion ─────────────────────────────────────────────────────────────────

const contactoSelect = {
  id: true,
  nombre: true,
  apellido1: true,
  razon_social: true,
  tipo: true,
} as const;

export const relacionRepository = {
  /** Todas las relaciones en las que participa un contacto (como origen o destino). */
  async findByContacto(contactoId: string): Promise<RelacionCompleta[]> {
    return prisma.relacion.findMany({
      where: {
        OR: [{ origen_id: contactoId }, { destino_id: contactoId }],
      },
      include: {
        tipo_relacion: true,
        origen:        { select: contactoSelect },
        destino:       { select: contactoSelect },
      },
      orderBy: { created_at: "asc" },
    }) as Promise<RelacionCompleta[]>;
  },

  async findById(id: string): Promise<RelacionCompleta | null> {
    return prisma.relacion.findUnique({
      where: { id },
      include: {
        tipo_relacion: true,
        origen:        { select: contactoSelect },
        destino:       { select: contactoSelect },
      },
    }) as Promise<RelacionCompleta | null>;
  },

  async create(data: {
    origen_id:             string;
    destino_id:            string;
    tipo_relacion_id:      string;
    notas?:                string;
    cargo?:                string;
    departamento_interno?: string;
    sede_vinculada_id?:    string;
  }): Promise<Relacion> {
    return prisma.relacion.create({ data });
  },

  async update(id: string, data: {
    notas?:                string | null;
    cargo?:                string | null;
    departamento_interno?: string | null;
    sede_vinculada_id?:    string | null;
  }): Promise<Relacion> {
    return prisma.relacion.update({ where: { id }, data });
  },

  async delete(id: string): Promise<void> {
    await prisma.relacion.delete({ where: { id } });
  },

  /**
   * Filtro de intersección: IDs de Contactos que tienen TODAS
   * las relaciones especificadas (por tipo_relacion_id, AND semántico).
   *
   * Uso en TAREA 3: se combina con etiqueta.repository.findEntidadesConTodasLasEtiquetas.
   */
  async findContactosConTodosLosTipos(tipo_ids: string[]): Promise<string[]> {
    if (tipo_ids.length === 0) return [];

    const sets = await Promise.all(
      tipo_ids.map((tid) =>
        prisma.relacion
          .findMany({
            where: { tipo_relacion_id: tid },
            select: { origen_id: true, destino_id: true },
          })
          .then((rows: { origen_id: string; destino_id: string }[]) => {
            const s = new Set<string>();
            rows.forEach((r) => { s.add(r.origen_id); s.add(r.destino_id); });
            return s;
          })
      )
    );

    const [first, ...rest] = sets;
    const intersection = [...first].filter((id) => rest.every((s: Set<string>) => s.has(id)));
    return intersection;
  },
};
