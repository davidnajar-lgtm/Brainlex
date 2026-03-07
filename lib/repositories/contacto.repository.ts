// ============================================================================
// lib/repositories/contacto.repository.ts — Capa de Acceso a Datos
//
// Responsabilidad ÚNICA: operaciones atómicas contra la BD via Prisma.
// CERO lógica de negocio aquí. Las decisiones las toma la capa de servicio.
// ============================================================================
import {
  AuditAction,
  AuditLog,
  Contacto,
  ContactoStatus,
  ContactoTipo,
  FiscalIdTipo,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

// ─── DTOs internos del repositorio ──────────────────────────────────────────

export type ContactoWithDependencyCounts = Contacto & {
  _count: { expedientes: number };
};

export type QuarantineContactRow = Contacto & {
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
  tipo_sociedad?: string | null;
  notas?: string | null;
  es_cliente?: boolean;
  // — Canales de Comunicación Directos —
  email_principal?: string | null;
  telefono_movil?:  string | null;
  telefono_fijo?:   string | null;
  website_url?:     string | null;
  linkedin_url?:    string | null;
  canal_preferido?: string;
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
  /** SHA-256(fiscal_id|fiscal_id_tipo) — solo en FORGET. Sin PII. */
  hash_identificador?: string;
  /** Base legal: "RGPD Art.17 — Derecho al Olvido" / "Prescripción art.70 GILF" */
  base_legal?: string;
  /** Conteo de registros destruidos: { contactos, expedientes, facturas, documentos_drive } */
  meta_counts?: Prisma.InputJsonValue;
  /** true = este log puede ser purgado cuando se formalice el Derecho al Olvido */
  purgeable?: boolean;
}

// ─── Repositorio ─────────────────────────────────────────────────────────────

export const contactoRepository = {
  /**
   * Devuelve los Contactos ACTIVOS ordenados por fecha de creación (más nuevo primero).
   * VETO LEGAL: los contactos en QUARANTINE o FORGOTTEN no son visibles por defecto.
   */
  async findAll(skip = 0, take = 50): Promise<Contacto[]> {
    return prisma.contacto.findMany({
      where:   { status: ContactoStatus.ACTIVE },
      orderBy: { created_at: "desc" },
      skip,
      take,
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
   * ⛔  GUARDIAN VETO — MÉTODO ELIMINADO
   *
   * Este método fue un backdoor que permitía transicionar a QUARANTINE
   * sin pasar por el AuditLog, violando la REGLA CISO (Audit before mutate).
   *
   * La ÚNICA forma autorizada de enviar un Contacto a QUARANTINE es:
   *   legalAgent.quarantine({ contactoId, quarantine_reason })
   *
   * Llamar a este método lanza un error explícito para que el compilador
   * y los tests detecten cualquier intento de bypass.
   */
  archive(_id: string): never {
    throw new Error(
      "[GUARDIAN VETO] contactoRepository.archive() está prohibido. " +
      "Usa legalAgent.quarantine({ contactoId, quarantine_reason }) " +
      "para transicionar a QUARANTINE con AuditLog obligatorio (REGLA CISO)."
    );
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
   * Todo borrado iniciado desde la interfaz debe pasar por legalAgent.quarantine() → QUARANTINE.
   */
  async dangerouslyHardDeleteForGdprComplianceOnly(id: string): Promise<void> {
    await prisma.contacto.delete({ where: { id } });
  },

  /**
   * Restaura un Contacto desde QUARANTINE a ACTIVE.
   * Borra quarantine_reason y quarantine_expires_at.
   * REGLA CISO: el llamante debe escribir el AuditLog(RESTORE) antes de llamar aquí.
   */
  async restore(id: string): Promise<Contacto> {
    return prisma.contacto.update({
      where: { id },
      data: {
        status:                ContactoStatus.ACTIVE,
        quarantine_reason:     null,
        quarantine_expires_at: null,
      },
    });
  },

  /**
   * Devuelve el historial de AuditLog para un Contacto, más reciente primero.
   * Solo lectura — la tabla audit_logs es inmutable (sin UPDATE/DELETE).
   */
  async findAuditLogs(recordId: string): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where:   { table_name: "contactos", record_id: recordId },
      orderBy: { created_at: "desc" },
    });
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
        quarantine_months: 60,
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

  /**
   * Busca un Contacto por NIF en TODOS los estados (ACTIVE, QUARANTINE, FORGOTTEN).
   * Usado para detectar el "Limbo Legal": un NIF en QUARANTINE que impide crear uno nuevo.
   */
  async findByFiscalIdAllStatuses(
    fiscal_id: string,
    fiscal_id_tipo: FiscalIdTipo
  ): Promise<Contacto | null> {
    return prisma.contacto.findFirst({
      where: { fiscal_id, fiscal_id_tipo },
    });
  },

  /**
   * Devuelve todos los Contactos en estado QUARANTINE con recuento de expedientes.
   * Ordenados por fecha de expiración ascendente (más urgentes primero).
   * Usado por el Guardian Dashboard (/admin/cuarentena).
   */
  async findAllQuarantine(): Promise<QuarantineContactRow[]> {
    return prisma.contacto.findMany({
      where:   { status: ContactoStatus.QUARANTINE },
      orderBy: { quarantine_expires_at: "asc" },
      include: { _count: { select: { expedientes: true } } },
    }) as Promise<QuarantineContactRow[]>;
  },

  /**
   * Devuelve los Contactos en QUARANTINE cuyo plazo de retención ha vencido.
   * Usado por el cron de purga automática (/api/cron/purge-quarantine).
   */
  async findExpiredQuarantine(): Promise<Contacto[]> {
    return prisma.contacto.findMany({
      where: {
        status:                ContactoStatus.QUARANTINE,
        quarantine_expires_at: { lte: new Date() },
      },
    });
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
