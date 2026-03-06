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

import { prisma } from "@/lib/prisma";
import { contactoRepository } from "@/lib/repositories/contacto.repository";
import {
  ContactoFormSchema,
  ContactoFieldErrors,
  CreateContactoInput,
  UpdateContactoInput,
  CreateContactoResult,
  UpdateContactoResult,
} from "@/lib/validations/contacto.schema";

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
  if (fields.includes("email")) {
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
  input: CreateContactoInput
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

  // ── Persistencia ───────────────────────────────────────────────────────────
  try {
    const companyId = await contactoRepository.ensureDefaultSociedad();
    await contactoRepository.create(
      {
        tipo: data.tipo,
        nombre: data.nombre?.trim() || null,
        apellido1: data.apellido1?.trim() || null,
        apellido2: data.apellido2?.trim() || null,
        razon_social: data.razon_social?.trim() || null,
        fiscal_id,
        fiscal_id_tipo: data.fiscal_id_tipo,
        email: data.email?.trim() || null,
        telefono: data.telefono?.trim() || null,
        tipo_telefono: data.tipo_telefono,
        tipo_sociedad: data.tipo_sociedad?.trim() || null,
        notas: data.notas?.trim() || null,
      },
      companyId
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: p2002Message(err.meta?.target) };
    }
    const message =
      err instanceof Error ? err.message : "Error desconocido al crear el Contacto.";
    console.error("[createContacto]", message);
    return { ok: false, error: message };
  }

  revalidatePath("/contactos");
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
      email: data.email?.trim() || null,
      telefono: data.telefono?.trim() || null,
      tipo_telefono: data.tipo_telefono,
      tipo_sociedad: data.tipo_sociedad?.trim() || null,
      notas: data.notas?.trim() || null,
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

  revalidatePath("/contactos");
  redirect("/contactos");
}

/**
 * Soft delete: mueve el Contacto a QUARANTINE.
 * VETO LEGAL: prohibido llamar a prisma.contacto.delete en esta entidad.
 */
export async function archiveContacto(id: string): Promise<void> {
  try {
    await contactoRepository.archive(id);
  } catch (err) {
    console.error("[archiveContacto]", err);
    throw err;
  }
  revalidatePath("/contactos");
}

type DeleteContactoResult = { ok: false; error: string } | undefined;

/**
 * Hard delete: borra físicamente el Contacto y sus company_links.
 *
 * REQUISITOS PREVIOS:
 *   - El contacto NO debe tener Expedientes asociados (FK bloqueará si los hay).
 *   - Uso exclusivo para contactos sin historial comercial o legal.
 *
 * NOTA ARQUITECTÓNICA: cuando existan relaciones fuertes (facturas, docs),
 * Prisma lanzará FK constraint y esta action devolverá un error gestionable.
 * En ese momento se migrará a "Smart Delete" con comprobación previa.
 */
export async function deleteContacto(
  id: string
): Promise<DeleteContactoResult> {
  try {
    // Comprobación de dependencias: bloquear si hay expedientes asociados
    const withCounts = await contactoRepository.findByIdWithCounts(id);
    if (!withCounts) return { ok: false, error: "Contacto no encontrado." };
    if (withCounts._count.expedientes > 0) {
      return {
        ok: false,
        error: `No se puede eliminar: el contacto tiene ${withCounts._count.expedientes} expediente(s) asociado(s). Usa "Archivar" para conservar el historial.`,
      };
    }

    // Hard delete atómico: borrar company_links (join table) → borrar contacto
    await prisma.$transaction([
      prisma.contactoCompanyLink.deleteMany({ where: { contacto_id: id } }),
      prisma.contacto.delete({ where: { id } }),
    ]);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Error desconocido al eliminar el Contacto.";
    console.error("[deleteContacto]", message);
    return { ok: false, error: message };
  }

  revalidatePath("/contactos");
  redirect("/contactos");
}
