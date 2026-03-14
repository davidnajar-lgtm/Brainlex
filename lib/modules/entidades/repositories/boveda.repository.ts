// ============================================================================
// lib/modules/entidades/repositories/boveda.repository.ts
//
// @role: @Data-Architect / @Doc-Specialist
// @spec: Visor de Bóveda — Acceso a datos para Carpeta y Archivo
//
// CERO lógica de negocio. Solo operaciones atómicas contra Prisma.
// ============================================================================

import { prisma } from "@/lib/prisma";
import type { Carpeta, Archivo, Etiqueta, Prisma } from "@prisma/client";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export type CarpetaConArchivos = Carpeta & { archivos: Archivo[] };

/** Carpeta con etiqueta (incluyendo parent) para filtrado de seguridad en ZIP. */
export type CarpetaConEtiquetaSeguridad = Carpeta & {
  archivos: Archivo[];
  etiqueta: (Etiqueta & { parent: Etiqueta | null }) | null;
};

// ─── Carpetas ───────────────────────────────────────────────────────────────

export const carpetaRepository = {
  /**
   * Todas las carpetas de un contacto con sus archivos.
   * @Scope-Guard — si companyId se pasa, filtra por tenant + GLOBAL (company_id null).
   * Si companyId es null/undefined → devuelve todas (SuperAdmin bypass).
   */
  async findByContacto(contactoId: string, companyId?: string | null): Promise<CarpetaConArchivos[]> {
    const where: Prisma.CarpetaWhereInput = { contacto_id: contactoId };

    if (companyId) {
      // INTELIGENTE: filtrar por etiqueta.scope (GLOBAL o tenant)
      // MANUAL: filtrar por company_id (o null = preexistentes sin tenant)
      where.OR = [
        { company_id: companyId },
        { company_id: null },          // carpetas preexistentes o heredadas
        { etiqueta: { scope: "GLOBAL" } },
      ];
    }

    return prisma.carpeta.findMany({
      where,
      include: { archivos: { orderBy: { nombre: "asc" } } },
      orderBy: [{ parent_id: "asc" }, { orden: "asc" }, { nombre: "asc" }],
    });
  },

  async findById(id: string) {
    return prisma.carpeta.findUnique({
      where: { id },
      include: { archivos: true, etiqueta: true },
    });
  },

  async create(data: Prisma.CarpetaCreateInput): Promise<Carpeta> {
    return prisma.carpeta.create({ data });
  },

  /** Crea carpeta con relación directa por IDs (sin nested create). */
  async createDirect(data: {
    nombre: string;
    tipo: "INTELIGENTE" | "MANUAL";
    contacto_id: string;
    company_id?: string | null;
    parent_id?: string | null;
    etiqueta_id?: string | null;
    es_blueprint?: boolean;
    orden?: number;
  }): Promise<Carpeta> {
    return prisma.carpeta.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        contacto_id: data.contacto_id,
        company_id: data.company_id ?? null,
        parent_id: data.parent_id ?? null,
        etiqueta_id: data.etiqueta_id ?? null,
        es_blueprint: data.es_blueprint ?? false,
        orden: data.orden ?? 0,
      },
    });
  },

  async update(id: string, data: Prisma.CarpetaUpdateInput): Promise<Carpeta> {
    return prisma.carpeta.update({ where: { id }, data });
  },

  /** Mover carpeta: cambiar parent_id y/o orden. */
  async move(id: string, parentId: string | null, orden: number): Promise<Carpeta> {
    return prisma.carpeta.update({
      where: { id },
      data: { parent_id: parentId, orden },
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.carpeta.delete({ where: { id } });
  },

  /** Contar carpetas hijas directas. */
  async countChildren(id: string): Promise<number> {
    return prisma.carpeta.count({ where: { parent_id: id } });
  },

  /** Carpetas INTELIGENTE de un contacto que tienen etiqueta_id asignada. */
  async findByContactoWithEtiquetas(contactoId: string) {
    return prisma.carpeta.findMany({
      where: {
        contacto_id: contactoId,
        tipo: "INTELIGENTE",
        etiqueta_id: { not: null },
      },
      select: { id: true, etiqueta_id: true, parent_id: true },
    });
  },

  /**
   * Todas las carpetas de un contacto con etiqueta y parent de etiqueta.
   * Usado para descarga ZIP con filtrado de seguridad (solo_super_admin + herencia).
   */
  async findByContactoWithSecurity(contactoId: string): Promise<CarpetaConEtiquetaSeguridad[]> {
    return prisma.carpeta.findMany({
      where: { contacto_id: contactoId },
      include: {
        archivos: { orderBy: { nombre: "asc" } },
        etiqueta: { include: { parent: true } },
      },
      orderBy: [{ parent_id: "asc" }, { orden: "asc" }, { nombre: "asc" }],
    });
  },
};

// ─── Archivos ───────────────────────────────────────────────────────────────

export const archivoRepository = {
  async findByCarpeta(carpetaId: string): Promise<Archivo[]> {
    return prisma.archivo.findMany({
      where: { carpeta_id: carpetaId },
      orderBy: { nombre: "asc" },
    });
  },

  async create(data: {
    nombre: string;
    carpeta_id: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    drive_file_id?: string | null;
  }): Promise<Archivo> {
    return prisma.archivo.create({
      data: {
        nombre: data.nombre,
        carpeta_id: data.carpeta_id,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        drive_file_id: data.drive_file_id ?? null,
      },
    });
  },

  /** Mover archivo a otra carpeta. */
  async move(id: string, carpetaId: string): Promise<Archivo> {
    return prisma.archivo.update({
      where: { id },
      data: { carpeta_id: carpetaId },
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.archivo.delete({ where: { id } });
  },
};
