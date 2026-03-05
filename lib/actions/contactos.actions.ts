// ============================================================================
// lib/actions/contactos.actions.ts — Server Actions: Contactos
//
// @role: Agente de Backend (controlador delgado)
// @spec: Micro-Spec 2.2 / 2.3 — Lectura y Alta de Contactos
// ============================================================================
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Contacto, ContactoTipo, FiscalIdTipo } from "@prisma/client";

import { contactoRepository } from "@/lib/repositories/contacto.repository";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type GetContactosResult =
  | { ok: true; data: Contacto[] }
  | { ok: false; error: string };

export interface CreateContactoInput {
  tipo: ContactoTipo;
  nombre?: string;
  apellido1?: string;
  apellido2?: string;
  razon_social?: string;
  fiscal_id_tipo: FiscalIdTipo;
  fiscal_id: string;
  email?: string;
  telefono?: string;
}

export type CreateContactoResult = { ok: false; error: string };

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los Contactos ordenados por fecha de creación (más nuevo primero).
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
 * redirect() se llama FUERA del try/catch (Next.js lo implementa con throw).
 */
export async function createContacto(
  input: CreateContactoInput
): Promise<CreateContactoResult> {
  // ── Validación manual ──────────────────────────────────────────────────────
  if (!input.fiscal_id?.trim()) {
    return { ok: false, error: "El NIF / CIF es obligatorio." };
  }
  if (input.tipo === ContactoTipo.PERSONA_FISICA && !input.nombre?.trim()) {
    return { ok: false, error: "El nombre es obligatorio para Persona Física." };
  }
  if (input.tipo === ContactoTipo.PERSONA_JURIDICA && !input.razon_social?.trim()) {
    return { ok: false, error: "La razón social es obligatoria para Persona Jurídica." };
  }

  // ── Persistencia ───────────────────────────────────────────────────────────
  try {
    const companyId = await contactoRepository.ensureDefaultSociedad();
    await contactoRepository.create(
      {
        tipo: input.tipo,
        nombre: input.nombre?.trim() || null,
        apellido1: input.apellido1?.trim() || null,
        apellido2: input.apellido2?.trim() || null,
        razon_social: input.razon_social?.trim() || null,
        fiscal_id: input.fiscal_id.trim(),
        fiscal_id_tipo: input.fiscal_id_tipo,
        email: input.email?.trim() || null,
        telefono: input.telefono?.trim() || null,
      },
      companyId
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al crear el Contacto.";
    console.error("[createContacto]", message);
    return { ok: false, error: message };
  }

  // ── redirect() fuera del try/catch ─────────────────────────────────────────
  revalidatePath("/contactos");
  redirect("/contactos");
}
