// ============================================================================
// lib/repositories/contacto.repository.ts — Capa de Acceso a Datos
//
// Responsabilidad ÚNICA: operaciones atómicas contra la BD via Prisma.
// CERO lógica de negocio aquí. Las decisiones las toma la capa de servicio.
// ============================================================================
import {
  AuditAction,
  Contacto,
  ContactoStatus,
  ContactoTipo,
  FiscalIdTipo,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

// ─── DTOs internos del repositorio ──────────────────────────────────────────

export type ContactoWithDependencyCounts = Contacto & {
  _count: { expedientes: number };
};

export interface QuarantineData {
  quarantine_reason: string;
  quarantine_expires_at: Date;
}

/** Datos mínimos para crear un Contacto nuevo. */
export interface CreateContactoData {
  tipo: ContactoTipo;
  nombre?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  razon_social?: string | null;
  fiscal_id?: string | null;
  fiscal_id_tipo?: FiscalIdTipo | null;
  email?: string | null;
  telefono?: string | null;
}

export interface AuditEntry {
  table_name: string;
  record_id: string;
  action: AuditAction;
  actor_id?: string;
  actor_email?: string;
  ip_address?: string;
  user_agent?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  notes?: string;
}

// ─── Repositorio ─────────────────────────────────────────────────────────────

export const contactoRepository = {
  /**
   * Devuelve todos los Contactos ordenados por fecha de creación (más nuevo primero).
   */
  async findAll(): Promise<Contacto[]> {
    return prisma.contacto.findMany({
      orderBy: { created_at: "desc" },
    });
  },

  /**
   * Busca un Contacto por ID incluyendo conteo de expedientes asociados.
   * Usado por la capa de servicio para la Fase 1 (Auditoría de dependencias).
   */
  async findByIdWithCounts(
    id: string
  ): Promise<ContactoWithDependencyCounts | null> {
    return prisma.contacto.findUnique({
      where: { id },
      include: { _count: { select: { expedientes: true } } },
    });
  },

  /**
   * Borrado físico. SOLO la capa de servicio puede llamar esto,
   * y únicamente tras verificar cero dependencias legales.
   */
  async hardDelete(id: string): Promise<void> {
    await prisma.contacto.delete({ where: { id } });
  },

  /**
   * Transición atómica a QUARANTINE.
   */
  async setQuarantine(id: string, data: QuarantineData): Promise<Contacto> {
    return prisma.contacto.update({
      where: { id },
      data: {
        status: ContactoStatus.QUARANTINE,
        quarantine_reason: data.quarantine_reason,
        quarantine_expires_at: data.quarantine_expires_at,
      },
    });
  },

  /**
   * Garantiza que exista al menos una SociedadHolding en la BD.
   * Si no hay ninguna (entorno de desarrollo), crea "Lexconomy Default".
   * Devuelve el company_id de la sociedad activa.
   */
  async ensureDefaultSociedad(): Promise<string> {
    const existing = await prisma.sociedadHolding.findFirst({
      select: { company_id: true },
    });
    if (existing) return existing.company_id;

    const created = await prisma.sociedadHolding.create({
      data: {
        company_id: "LX",
        nombre: "Lexconomy Default",
        quarantine_months: 48,
      },
    });
    return created.company_id;
  },

  /**
   * Crea un Contacto nuevo y lo vincula al tenant indicado.
   * Operación atómica via nested create de Prisma.
   */
  async create(data: CreateContactoData, companyId: string): Promise<Contacto> {
    return prisma.contacto.create({
      data: {
        ...data,
        company_links: {
          create: [{ company_id: companyId }],
        },
      },
    });
  },

  /**
   * Escribe una entrada INMUTABLE en el AuditLog.
   * Esta tabla nunca recibe UPDATE ni DELETE (diseño deliberado del schema).
   */
  async appendAuditLog(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({ data: entry });
  },
};

// ─── Repositorio de SociedadHolding (solo lectura aquí) ──────────────────────

export const sociedadRepository = {
  /**
   * Obtiene los meses de cuarentena configurados para un tenant concreto.
   */
  async getQuarantineMonths(
    company_id: string
  ): Promise<{ quarantine_months: number } | null> {
    return prisma.sociedadHolding.findUnique({
      where: { company_id },
      select: { quarantine_months: true },
    });
  },
};
