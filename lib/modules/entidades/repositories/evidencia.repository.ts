// ============================================================================
// lib/modules/entidades/repositories/evidencia.repository.ts
//
// @role: @Data-Architect
// @spec: FASE 13.06 — Evidencias de Relaciones
//
// CRUD atómico para EvidenciaRelacion. CERO lógica de negocio.
// ============================================================================

import { prisma } from "@/lib/prisma";

export const evidenciaRepository = {
  async findByRelacion(relacionId: string) {
    return prisma.evidenciaRelacion.findMany({
      where: { relacion_id: relacionId },
      orderBy: { created_at: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.evidenciaRelacion.findUnique({ where: { id } });
  },

  async create(data: {
    relacion_id:   string;
    nombre:        string;
    mime_type?:    string | null;
    size_bytes?:   number | null;
    drive_file_id?: string | null;
  }) {
    return prisma.evidenciaRelacion.create({ data });
  },

  async delete(id: string) {
    await prisma.evidenciaRelacion.delete({ where: { id } });
  },

  async countByRelacion(relacionId: string) {
    return prisma.evidenciaRelacion.count({ where: { relacion_id: relacionId } });
  },
};
