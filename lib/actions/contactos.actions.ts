// ============================================================================
// lib/actions/contactos.actions.ts — Server Actions: Contactos
//
// @role: Agente de Backend (controlador delgado)
// @spec: Micro-Spec 2.2 / 2.3 / 2.4 / 2.5 — CRUD + Soft Delete + Zod
// ============================================================================
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Contacto, FiscalIdTipo, Prisma } from "@prisma/client";
import { normalizeAddress } from "@/lib/utils/normalizeAddress";


import { prisma } from "@/lib/prisma";
import { contactoRepository } from "@/lib/repositories/contacto.repository";
import { legalAgent } from "@/lib/services/legalAgent.middleware";
import {
  LegalBlockError,
  BusinessValidationError,
  EntityNotFoundError,
} from "@/lib/errors/business.errors";
import {
  ContactoFormSchema,
  ContactoFieldErrors,
  CreateContactoInput,
  UpdateContactoInput,
  CreateContactoResult,
  UpdateContactoResult,
} from "@/lib/validations/contacto.schema";

// ─── Tipos compartidos ────────────────────────────────────────────────────────

/**
 * Dirección inicial capturada desde el autocompletado de Google Places.
 * Se persiste como Direccion (tipo FISCAL, es_principal=true) al crear el contacto.
 */
export type InlineAddressData = {
  calle:          string;
  ciudad?:        string;
  provincia?:     string;
  codigo_postal?: string;
  pais?:          string;
};

// ─── Tipos resultado (solo para RSC — no re-exportados desde "use server") ────
// Los clientes deben importar tipos desde @/lib/validations/contacto.schema

type GetContactosResult =
  | { ok: true; data: Contacto[] }
  | { ok: false; error: string };

type GetContactoResult =
  | { ok: true; data: Contacto }
  | { ok: false; error: string };

// ─── Helper: mensaje legible para violaciones de unicidad (P2002) ─────────────

function p2002Message(target: unknown): string {
  const fields = Array.isArray(target) ? (target as string[]) : [];
  if (fields.includes("email_principal")) {
    return "Ya existe un contacto registrado con este email.";
  }
  if (fields.includes("fiscal_id") || fields.includes("fiscal_id_tipo")) {
    return "Ya existe un contacto registrado con este identificador fiscal.";
  }
  return "Ya existe un contacto con estos datos. Comprueba el email o el identificador fiscal.";
}

// ─── Helper: extrae fieldErrors del resultado Zod ────────────────────────────

function extractFieldErrors(
  issues: { path: PropertyKey[]; message: string }[]
): ContactoFieldErrors {
  const errors: ContactoFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" || typeof key === "number") {
      const field = key as keyof ContactoFieldErrors;
      if (!errors[field]) errors[field] = issue.message;
    }
  }
  return errors;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los Contactos ACTIVOS, ordenados por fecha de creación.
 */
export async function getContactos(): Promise<GetContactosResult> {
  try {
    const data = await contactoRepository.findAll();
    return { ok: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al consultar Contactos.";
    console.error("[getContactos]", message);
    return { ok: false, error: message };
  }
}

/**
 * Crea un Contacto nuevo con su link de tenant.
 * Valida con Zod antes de persistir — devuelve fieldErrors por campo si falla.
 * redirect() se llama FUERA del try/catch (Next.js lo implementa con throw).
 */
export async function createContacto(
  input: CreateContactoInput,
  initialAddress?: InlineAddressData
): Promise<CreateContactoResult> {
  // ── Validación Zod ─────────────────────────────────────────────────────────
  const parsed = ContactoFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados en rojo.",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const data = parsed.data;

  // ── SANITIZACIÓN: SIN_REGISTRO → fiscal_id forzado a null ─────────────────
  const fiscal_id =
    data.fiscal_id_tipo === FiscalIdTipo.SIN_REGISTRO
      ? null
      : data.fiscal_id.trim().toUpperCase();

  // ── Persistencia atómica ────────────────────────────────────────────────────
  // BUG FIX: Contacto + Direccion en una sola $transaction.
  // Si la Direccion falla, el Contacto se revierte automáticamente (atomicidad).
  // Antes, dos llamadas Prisma separadas podían crear un Contacto huérfano
  // si la creación de la Direccion lanzaba un error.
  try {
    const companyId = await contactoRepository.ensureDefaultSociedad();

    await prisma.$transaction(async (tx) => {
      // 1. Crear Contacto + company_link en una sola operación anidada
      const newContact = await tx.contacto.create({
        data: {
          tipo:            data.tipo,
          nombre:          data.nombre?.trim()        || null,
          apellido1:       data.apellido1?.trim()     || null,
          apellido2:       data.apellido2?.trim()     || null,
          razon_social:    data.razon_social?.trim()  || null,
          fiscal_id,
          fiscal_id_tipo:  data.fiscal_id_tipo,
          tipo_sociedad:   data.tipo_sociedad?.trim() || null,
          notas:           data.notas?.trim()         || null,
          es_cliente:      data.es_cliente            ?? false,
          email_principal: data.email_principal?.trim() || null,
          telefono_movil:  data.telefono_movil?.trim()  || null,
          telefono_fijo:   data.telefono_fijo?.trim()   || null,
          website_url:     data.website_url?.trim()     || null,
          linkedin_url:    data.linkedin_url?.trim()    || null,
          canal_preferido: data.canal_preferido         ?? "EMAIL",
          company_links: {
            create: [{ company_id: companyId }],
          },
        },
      });

      // 2. Crear Direccion inicial (Google Places) dentro de la misma transacción.
      // Condición ampliada: creamos Direccion si hay calle, ciudad o código postal
      // (antes solo con calle → empresas en centros comerciales sin route se perdían).
      const hasAddressData =
        initialAddress &&
        (initialAddress.calle || initialAddress.ciudad || initialAddress.codigo_postal);

      if (hasAddressData) {
        await tx.direccion.create({
          data: {
            contactoId:    newContact.id,
            tipo:          "FISCAL",
            // Normalizar calle; si viene vacía usar ciudad como referencia temporal
            calle:         normalizeAddress(
                             initialAddress.calle ||
                             initialAddress.ciudad ||
                             "Pendiente de completar"
                           ),
            ciudad:        initialAddress.ciudad
                             ? normalizeAddress(initialAddress.ciudad)
                             : null,
            provincia:     initialAddress.provincia
                             ? normalizeAddress(initialAddress.provincia)
                             : null,
            codigo_postal: initialAddress.codigo_postal?.toUpperCase() || null,
            pais:          (initialAddress.pais ?? "ES").toUpperCase(),
            es_principal:  true,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: p2002Message(err.meta?.target) };
    }
    const message =
      err instanceof Error ? err.message : "Error desconocido al crear el Contacto.";
    console.error("[createContacto]", message);
    return { ok: false, error: message };
  }

  // BUG FIX: revalidatePath con "layout" invalida /contactos Y todos sus hijos
  // (/contactos/[id], /contactos/nuevo, etc.) en el Router Cache del cliente.
  // Antes, solo se invalidaba /contactos → la ficha del contacto podía mostrar
  // datos cacheados al navegar de vuelta a ella tras crear/editar.
  revalidatePath("/contactos", "layout");
  redirect("/contactos");
}

/**
 * Carga un Contacto por ID (cualquier estado). Usado por la vista de edición.
 */
export async function getContactoById(id: string): Promise<GetContactoResult> {
  try {
    const data = await contactoRepository.findById(id);
    if (!data) return { ok: false, error: "Contacto no encontrado." };
    return { ok: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al cargar el Contacto.";
    console.error("[getContactoById]", message);
    return { ok: false, error: message };
  }
}

/**
 * Actualiza los campos editables de un Contacto existente.
 * Valida con Zod antes de persistir — devuelve fieldErrors por campo si falla.
 * redirect() se llama FUERA del try/catch.
 */
export async function updateContacto(
  id: string,
  input: UpdateContactoInput
): Promise<UpdateContactoResult> {
  // ── Validación Zod ─────────────────────────────────────────────────────────
  const parsed = ContactoFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados en rojo.",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const data = parsed.data;

  // ── SANITIZACIÓN: SIN_REGISTRO → fiscal_id forzado a null ─────────────────
  const fiscal_id =
    data.fiscal_id_tipo === FiscalIdTipo.SIN_REGISTRO
      ? null
      : data.fiscal_id.trim().toUpperCase();

  // ── Persistencia ───────────────────────────────────────────────────────────
  try {
    await contactoRepository.update(id, {
      tipo: data.tipo,
      nombre: data.nombre?.trim() || null,
      apellido1: data.apellido1?.trim() || null,
      apellido2: data.apellido2?.trim() || null,
      razon_social: data.razon_social?.trim() || null,
      fiscal_id,
      fiscal_id_tipo: data.fiscal_id_tipo,
      tipo_sociedad: data.tipo_sociedad?.trim() || null,
      notas: data.notas?.trim() || null,
      es_cliente: data.es_cliente ?? false,
      email_principal: data.email_principal?.trim() || null,
      telefono_movil:  data.telefono_movil?.trim()  || null,
      telefono_fijo:   data.telefono_fijo?.trim()   || null,
      website_url:     data.website_url?.trim()     || null,
      linkedin_url:    data.linkedin_url?.trim()    || null,
      canal_preferido: data.canal_preferido ?? "EMAIL",
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: p2002Message(err.meta?.target) };
    }
    const message =
      err instanceof Error ? err.message : "Error desconocido al actualizar el Contacto.";
    console.error("[updateContacto]", message);
    return { ok: false, error: message };
  }

  revalidatePath("/contactos", "layout");
  redirect("/contactos");
}

/**
 * Soft delete: envía el Contacto a QUARANTINE con motivo obligatorio.
 *
 * Flujo:
 *   1. legalAgent.quarantine() valida el motivo (mínimo 5 caracteres).
 *   2. Escribe AuditLog ANTES de mutar el estado (REGLA CISO).
 *   3. Resuelve quarantine_months del primer tenant vinculado (default 60).
 *   4. Actualiza status → QUARANTINE con quarantine_expires_at calculada.
 *
 * VETO LEGAL: prohibido llamar a prisma.contacto.delete en esta entidad.
 */
export type ArchiveContactoResult =
  | { ok: true;  expires_at: Date }
  | { ok: false; error: string; field?: string };

export async function archiveContacto(
  id: string,
  quarantine_reason: string
): Promise<ArchiveContactoResult> {
  try {
    const { expires_at } = await legalAgent.quarantine({
      contactoId: id,
      quarantine_reason,
    });
    revalidatePath("/contactos", "layout");
    return { ok: true, expires_at };
  } catch (err) {
    if (err instanceof BusinessValidationError) {
      return { ok: false, error: err.message, field: err.field };
    }
    if (err instanceof EntityNotFoundError) {
      return { ok: false, error: `Contacto no encontrado (${id}).` };
    }
    const message =
      err instanceof Error ? err.message : "Error desconocido al archivar el Contacto.";
    console.error("[archiveContacto]", message);
    return { ok: false, error: message };
  }
}

// ─── restoreContacto ──────────────────────────────────────────────────────────

export type RestoreContactoResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Restaura un Contacto desde QUARANTINE → ACTIVE.
 *
 * Flujo:
 *   1. Verifica que el Contacto existe y está en QUARANTINE.
 *   2. Escribe AuditLog(RESTORE) ANTES de mutar el estado (REGLA CISO).
 *   3. Limpia quarantine_reason y quarantine_expires_at.
 *
 * VETO LEGAL: solo se puede restaurar un Contacto en QUARANTINE.
 * Un Contacto FORGOTTEN no puede restaurarse (crypto-shredding irreversible).
 */
export async function restoreContacto(id: string): Promise<RestoreContactoResult> {
  try {
    const contacto = await contactoRepository.findByIdWithCounts(id);
    if (!contacto) return { ok: false, error: `Contacto no encontrado (${id}).` };

    if (contacto.status !== "QUARANTINE") {
      return { ok: false, error: "Solo se pueden restaurar contactos en estado QUARANTINE." };
    }

    // AuditLog ANTES de mutar — REGLA CISO
    await contactoRepository.appendAuditLog({
      table_name: "contactos",
      record_id:  id,
      action:     "RESTORE",
      old_data: {
        status:                contacto.status,
        quarantine_reason:     contacto.quarantine_reason ?? null,
        quarantine_expires_at: contacto.quarantine_expires_at?.toISOString() ?? null,
      },
      new_data: { status: "ACTIVE" },
      notes:    "[RESTAURACIÓN MANUAL] Contacto restaurado a ACTIVE desde la Ficha Ampliada.",
    });

    await contactoRepository.restore(id);
    revalidatePath("/contactos", "layout");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al restaurar el Contacto.";
    console.error("[restoreContacto]", message);
    return { ok: false, error: message };
  }
}

export type DeleteContactoResult =
  | { ok: false;  error: string }
  | { ok: "quarantined"; message: string; expires_at: Date; reasons: string[] }
  | undefined;

/**
 * Eliminar un Contacto — delegado al Agente Legal (legalAgent.interceptDelete).
 *
 * Flujo de 3 fases (Micro-Spec 1.2):
 *   FASE 1 — Auditoría:    checkLegalDependencies (expedientes, facturas, Drive).
 *   FASE 2 — Bloqueo:      si hay dependencias → QUARANTINE automática + 403.
 *   FASE 3 — Purga:        sin dependencias → DELETE físico + AuditLog(FORGET).
 *
 * REGLA CISO: el AuditLog se escribe SIEMPRE antes de mutar el estado.
 * MULTITENANT: opera sobre la entidad global sin restricción de company_id.
 *
 * El veredicto QUARANTINED no es un error — es una respuesta controlada al
 * cliente para que muestre el estado de cuarentena sin tratar el 403 como fallo.
 */
export async function deleteContacto(
  id: string,
  quarantine_reason?: string
): Promise<DeleteContactoResult> {
  try {
    const verdict = await legalAgent.interceptDelete({
      contactoId: id,
      quarantine_reason,
    });

    // Veredicto PURGED: borrado físico completado → redirigir
    if (verdict.verdict === "PURGED") {
      revalidatePath("/contactos", "layout");
      redirect("/contactos");
    }
  } catch (err) {
    // Veredicto QUARANTINED: el Agente Legal bloqueó el borrado y archivó
    if (err instanceof LegalBlockError) {
      revalidatePath("/contactos", "layout");
      // Recuperar expires_at de la BD para retornarlo al cliente
      const updated = await contactoRepository.findByIdWithCounts(err.contactoId);
      return {
        ok:         "quarantined",
        message:    err.message,
        expires_at: updated?.quarantine_expires_at ?? new Date(),
        reasons:    [],
      };
    }

    if (err instanceof EntityNotFoundError) {
      return { ok: false, error: `Contacto no encontrado (${id}).` };
    }

    const message =
      err instanceof Error
        ? err.message
        : "Error desconocido al procesar la solicitud de borrado.";
    console.error("[deleteContacto]", message);
    return { ok: false, error: message };
  }
}
