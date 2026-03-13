// ============================================================================
// lib/modules/entidades/repositories/boveda.repository.ts
//
// @role: @Data-Architect / @Doc-Specialist
// @spec: Visor de Bóveda — Acceso a datos para Carpeta y Archivo
//
// CERO lógica de negocio. Solo operaciones atómicas contra Prisma.
// ============================================================================

import { prisma } from "@/lib/prisma";
import type { Carpeta, Archivo, Prisma } from "@prisma/client";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export type CarpetaConArchivos = Carpeta & { archivos: Archivo[] };

// ─── Carpetas ───────────────────────────────────────────────────────────────

export const carpetaRepository = {
  /** Todas las carpetas de un contacto con sus archivos. */
  async findByContacto(contactoId: string): Promise<CarpetaConArchivos[]> {
    return prisma.carpeta.findMany({
      where: { contacto_id: contactoId },
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
