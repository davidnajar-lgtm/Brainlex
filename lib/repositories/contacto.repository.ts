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
  TipoTelefono,
  Prisma,
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
  tipo_telefono?: TipoTelefono;
  tipo_sociedad?: string | null;
  notas?: string | null;
}

export interface AuditEntry {
  table_name: string;
  record_id: string;
  action: AuditAction;
  actor_id?: string;
  actor_email?: string;
  ip_address?: string;
  user_agent?: string;
  old_data?: Prisma.InputJsonValue;
  new_data?: Prisma.InputJsonValue;
  notes?: string;
}

// ─── Repositorio ─────────────────────────────────────────────────────────────

export const contactoRepository = {
  /**
   * Devuelve los Contactos ACTIVOS ordenados por fecha de creación (más nuevo primero).
   * VETO LEGAL: los contactos en QUARANTINE o FORGOTTEN no son visibles por defecto.
   */
  async findAll(): Promise<Contacto[]> {
    return prisma.contacto.findMany({
      where: { status: ContactoStatus.ACTIVE },
      orderBy: { created_at: "desc" },
    });
  },

  /**
   * Busca un Contacto por ID (cualquier estado).
   */
  async findById(id: string): Promise<Contacto | null> {
    return prisma.contacto.findUnique({ where: { id } });
  },

  /**
   * Actualiza los campos editables de un Contacto.
   */
  async update(id: string, data: Partial<CreateContactoData>): Promise<Contacto> {
    return prisma.contacto.update({ where: { id }, data });
  },

  /**
   * Soft delete: transición a QUARANTINE con razón y plazo estándar del tenant.
   * NUNCA llames a prisma.contacto.delete desde esta capa.
   */
  async archive(id: string): Promise<Contacto> {
    return prisma.contacto.update({
      where: { id },
      data: {
        status: ContactoStatus.QUARANTINE,
        quarantine_reason:
          "Archivado manualmente desde el panel de administración.",
        // Plazo legal estándar: 48 meses (art. 30 CComercio / Ley 58/2003)
        quarantine_expires_at: new Date(
          Date.now() + 48 * 30 * 24 * 60 * 60 * 1000
        ),
      },
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
   * ⚠️  MÉTODO RESTRINGIDO — USO EXCLUSIVO DPO / ADMINISTRADOR PRINCIPAL
   *
   * Ejecuta el borrado físico irreversible de un Contacto de la base de datos.
   *
   * ÚNICAS circunstancias legales de uso:
   *   1. Ejercicio formal del Derecho al Olvido (RGPD Art. 17) solicitado por
   *      el interesado y verificado por el Delegado de Protección de Datos (DPO).
   *   2. Resolución judicial firme que ordene la eliminación del registro.
   *   3. Constatación de que el Contacto NO tiene historial comercial ni legal
   *      (cero expedientes, cero facturas, cero documentos asociados).
   *
   * PRERREQUISITOS obligatorios antes de llamar a este método:
   *   - Autorización escrita del DPO o del administrador principal del sistema.
   *   - Registro previo en el AuditLog con action=FORGET y notas de justificación.
   *   - Verificación de cero dependencias via findByIdWithCounts().
   *
   * PROHIBIDO exponer este método en cualquier Server Action accesible desde la UI.
   * Todo borrado iniciado desde la interfaz debe pasar por archive() → QUARANTINE.
   */
  async dangerouslyHardDeleteForGdprComplianceOnly(id: string): Promise<void> {
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
