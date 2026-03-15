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
import type { Contacto, EtiquetaScope, Prisma, Relacion, TipoRelacion } from "@prisma/client";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type SedeVinculadaInfo = {
  id: string;
  tipo: string;
  etiqueta: string | null;
  calle: string;
  ciudad: string | null;
};

export type RelacionCompleta = Relacion & {
  tipo_relacion: TipoRelacion;
  origen:        Pick<Contacto, "id" | "nombre" | "apellido1" | "razon_social" | "tipo">;
  destino:       Pick<Contacto, "id" | "nombre" | "apellido1" | "razon_social" | "tipo">;
  /** Campos extendidos de Ecosistema (pueden ser null) */
  cargo?:                string | null;
  departamento_interno?: string | null;
  sede_vinculada_id?:    string | null;
  /** Porcentaje de participación societaria (0–100). Solo tipos societarios. */
  porcentaje?:           number | null;
  /** Sede vinculada resolveada (puede no existir si la dirección se borró) */
  sede_vinculada?:       SedeVinculadaInfo | null;
};

// ─── TipoRelacion ─────────────────────────────────────────────────────────────

export const tipoRelacionRepository = {
  async findAll(): Promise<TipoRelacion[]> {
    return prisma.tipoRelacion.findMany({
      orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    });
  },

  /** Filtra tipos por scope del tenant activo (GLOBAL + tenant-specific). */
  async findByScope(tenantScope: EtiquetaScope): Promise<TipoRelacion[]> {
    return prisma.tipoRelacion.findMany({
      where: { scope: { in: ["GLOBAL", tenantScope] } },
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
    try {
      return await prisma.relacion.count({ where: { tipo_relacion_id: id, activa: true } });
    } catch {
      // Pre-migración fallback
      return prisma.relacion.count({ where: { tipo_relacion_id: id } });
    }
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
  /** Relaciones ACTIVAS en las que participa un contacto (como origen o destino). */
  async findByContacto(contactoId: string): Promise<RelacionCompleta[]> {
    const relaciones = await prisma.relacion.findMany({
      where: {
        OR: [{ origen_id: contactoId }, { destino_id: contactoId }],
      },
      include: {
        tipo_relacion: true,
        origen:        { select: contactoSelect },
        destino:       { select: contactoSelect },
      },
      orderBy: { created_at: "asc" },
    });

    // Resolver sede_vinculada (FK lógica, no Prisma relation)
    const sedeIds = relaciones
      .map((r) => r.sede_vinculada_id)
      .filter((id): id is string => id !== null);

    let sedeMap = new Map<string, SedeVinculadaInfo>();
    if (sedeIds.length > 0) {
      const sedes = await prisma.direccion.findMany({
        where: { id: { in: sedeIds } },
        select: { id: true, tipo: true, etiqueta: true, calle: true, ciudad: true },
      });
      sedeMap = new Map(sedes.map((s) => [s.id, s]));
    }

    return relaciones.map((r) => ({
      ...r,
      sede_vinculada: r.sede_vinculada_id ? sedeMap.get(r.sede_vinculada_id) ?? null : null,
    })) as RelacionCompleta[];
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
    porcentaje?:           number;
  }): Promise<Relacion> {
    return prisma.relacion.create({ data });
  },

  async update(id: string, data: {
    notas?:                string | null;
    cargo?:                string | null;
    departamento_interno?: string | null;
    sede_vinculada_id?:    string | null;
    porcentaje?:           number | null;
  }): Promise<Relacion> {
    return prisma.relacion.update({ where: { id }, data });
  },

  /** Relaciones ARCHIVADAS (histórico) de un contacto. */
  async findArchivedByContacto(contactoId: string): Promise<RelacionCompleta[]> {
    try {
      const relaciones = await prisma.relacion.findMany({
        where: {
          activa: false,
          OR: [{ origen_id: contactoId }, { destino_id: contactoId }],
        },
        include: {
          tipo_relacion: true,
          origen:        { select: contactoSelect },
          destino:       { select: contactoSelect },
        },
        orderBy: { archivada_at: "desc" },
      });
      return relaciones as RelacionCompleta[];
    } catch {
      // Pre-migración: no hay columna activa → no hay archivadas
      return [];
    }
  },

  /** Soft-delete: marca la relación como archivada. */
  async archive(id: string, motivo: string): Promise<Relacion> {
    return prisma.relacion.update({
      where: { id },
      data: {
        activa: false,
        archivada_at: new Date(),
        archivo_motivo: motivo,
      },
    });
  },

  /** Restaura una relación archivada a estado activo. */
  async restore(id: string): Promise<Relacion> {
    return prisma.relacion.update({
      where: { id },
      data: {
        activa: true,
        archivada_at: null,
        archivo_motivo: null,
      },
    });
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
