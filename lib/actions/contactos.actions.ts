// ============================================================================
// lib/actions/contactos.actions.ts — Server Actions: Contactos
//
// @role: Agente de Backend (controlador delgado)
// @spec: Micro-Spec 2.2 / 2.3 / 2.4 / 2.5 — CRUD + Soft Delete + Zod
// ============================================================================
"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Contacto, ContactoStatus, FiscalIdTipo, Prisma } from "@prisma/client";
import { normalizeAddress } from "@/lib/utils/normalizeAddress";
import { isMatrizCif } from "@/lib/config/matrizConfig";


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

  // ── Detección "Limbo Legal": ¿existe este NIF en QUARANTINE? ───────────────
  // Si el NIF ya existe pero en cuarentena, devolvemos conflictType para que
  // la UI ofrezca la resurrección en lugar de un error de duplicado genérico.
  if (fiscal_id && data.fiscal_id_tipo !== FiscalIdTipo.SIN_REGISTRO) {
    const existing = await contactoRepository.findByFiscalIdAllStatuses(
      fiscal_id,
      data.fiscal_id_tipo
    );
    if (existing?.status === "QUARANTINE") {
      const contactoName =
        existing.razon_social ||
        [existing.nombre, existing.apellido1].filter(Boolean).join(" ") ||
        existing.fiscal_id ||
        "Contacto archivado";
      return {
        ok:                   false,
        error:                "Este identificador ya existe en el archivo de cuarentena.",
        conflictType:         "QUARANTINE_RESURRECTION" as const,
        quarantineContactoId: existing.id,
        contactoName,
      };
    }
  }

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
          // Auto-protección: CIFs configurados en BRAINLEX_MATRIZ_CIFS reciben
          // es_facturadora=true automáticamente — veto de borrado garantizado.
          ...(isMatrizCif(fiscal_id) && { es_facturadora: true }),
          email_principal: data.email_principal?.trim() || null,
          telefono_movil:  data.telefono_movil?.trim()  || null,
          telefono_fijo:   data.telefono_fijo?.trim()   || null,
          website_url:     data.website_url?.trim().toLowerCase()  || null,
          linkedin_url:    data.linkedin_url?.trim().toLowerCase() || null,
          canal_preferido: data.canal_preferido         ?? "EMAIL",
          company_links: {
            create: [{ company_id: companyId }],
          },
        },
      });

      // 2. Crear entradas en CanalComunicacion para los teléfonos directos.
      // El primer teléfono capturado (movil > fijo) se marca como favorito.
      // Esto alimenta el Pool de Teléfonos visible en TabFiliacion.
      const movil = data.telefono_movil?.trim() || null;
      const fijo  = data.telefono_fijo?.trim()  || null;

      if (movil) {
        await tx.canalComunicacion.create({
          data: {
            contactoId:  newContact.id,
            tipo:        "TELEFONO",
            subtipo:     "MOVIL",
            valor:       movil,
            etiqueta:    "Móvil",
            es_principal: true,
            es_favorito:  true,
          },
        });
      }
      if (fijo) {
        await tx.canalComunicacion.create({
          data: {
            contactoId:  newContact.id,
            tipo:        "TELEFONO",
            subtipo:     "FIJO",
            valor:       fijo,
            etiqueta:    "Fijo",
            es_principal: !movil, // principal solo si no hay móvil
            es_favorito:  !movil, // favorito solo si no hay móvil
          },
        });
      }

      // 3. Crear Direccion inicial (Google Places) dentro de la misma transacción.
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
      // Auto-protección: si el nuevo fiscal_id está en BRAINLEX_MATRIZ_CIFS,
      // forzar es_facturadora=true. Nunca se auto-desactiva (solo Admin puede).
      ...(isMatrizCif(fiscal_id) && { es_facturadora: true }),
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

// ─── resurrectionRestoreContacto ──────────────────────────────────────────────

/**
 * Flujo de "Resurrección": Restaura un Contacto desde QUARANTINE → ACTIVE
 * Y actualiza sus datos con los valores que el usuario intentó crear.
 *
 * Usado exclusivamente desde el formulario de Alta cuando se detecta un
 * "Limbo Legal" (NIF existente en QUARANTINE).
 *
 * REGLA CISO: AuditLog(RESTORE) + AuditLog(UPDATE) escritos ANTES de mutar.
 */
export async function resurrectionRestoreContacto(
  id: string,
  input: CreateContactoInput,
  initialAddress?: InlineAddressData
): Promise<RestoreContactoResult> {
  const parsed = ContactoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los campos del formulario." };
  }

  const data = parsed.data;
  const fiscal_id =
    data.fiscal_id_tipo === FiscalIdTipo.SIN_REGISTRO
      ? null
      : data.fiscal_id.trim().toUpperCase();

  try {
    const contacto = await contactoRepository.findByIdWithCounts(id);
    if (!contacto) return { ok: false, error: `Contacto no encontrado (${id}).` };
    if (contacto.status !== "QUARANTINE") {
      return { ok: false, error: "Solo se puede resucitar un Contacto en estado QUARANTINE." };
    }

    // AuditLog(RESTORE) ANTES de mutar — REGLA CISO
    await contactoRepository.appendAuditLog({
      table_name: "contactos",
      record_id:  id,
      action:     "RESTORE",
      old_data: {
        status:                contacto.status,
        quarantine_reason:     contacto.quarantine_reason ?? null,
        quarantine_expires_at: contacto.quarantine_expires_at?.toISOString() ?? null,
      },
      new_data: { status: "ACTIVE", fiscal_id },
      notes:
        "[RESURRECCIÓN] Contacto restaurado desde el formulario de Alta. " +
        "Los datos se han actualizado con los valores del nuevo intento de alta.",
    });

    await prisma.$transaction(async (tx) => {
      // Restore + update en una sola operación atómica
      await tx.contacto.update({
        where: { id },
        data: {
          status:                ContactoStatus.ACTIVE,
          quarantine_reason:     null,
          quarantine_expires_at: null,
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
          website_url:     data.website_url?.trim().toLowerCase()  || null,
          linkedin_url:    data.linkedin_url?.trim().toLowerCase() || null,
          canal_preferido: data.canal_preferido         ?? "EMAIL",
        },
      });

      // Crear dirección inicial (Google Places) si se proporcionó
      const hasAddressData =
        initialAddress &&
        (initialAddress.calle || initialAddress.ciudad || initialAddress.codigo_postal);
      if (hasAddressData) {
        await tx.direccion.create({
          data: {
            contactoId:    id,
            tipo:          "FISCAL",
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
    const message =
      err instanceof Error ? err.message : "Error desconocido en la resurrección del Contacto.";
    console.error("[resurrectionRestoreContacto]", message);
    return { ok: false, error: message };
  }

  revalidatePath("/contactos", "layout");
  redirect(`/contactos/${id}`);
}

// ─── passAwayContacto ─────────────────────────────────────────────────────────

export type PassAwayResult =
  | { ok: true; hash_identificador: string }
  | { ok: false; error: string; vetoReasons?: string[] };

/**
 * "Pass Away" — Borrado físico de un Contacto en QUARANTINE.
 *
 * Flujo:
 *   1. Verifica que el Contacto existe y está en QUARANTINE.
 *   2. Comprueba dependencias vía legalAgent (expedientes, facturas, Drive).
 *   3. Si hay dependencias → VETO, devuelve motivos sin mutar nada.
 *   4. Escribe AuditLog(FORGET) ANTES de mutar (REGLA CISO).
 *   5. Elimina company_links (FK sin cascade) y luego el Contacto en $transaction.
 *
 * ACCESO RESTRINGIDO: solo desde el Guardian Dashboard (/admin/cuarentena).
 * VETO LEGAL: imposible si el contacto tiene expedientes, facturas o documentos Drive.
 */
export async function passAwayContacto(id: string): Promise<PassAwayResult> {
  try {
    const contacto = await contactoRepository.findByIdWithCounts(id);
    if (!contacto) return { ok: false, error: `Contacto no encontrado (${id}).` };
    if (contacto.status !== "QUARANTINE") {
      return { ok: false, error: "Solo se puede ejecutar Pass Away sobre contactos en QUARANTINE." };
    }

    // REGLA CISO — Verificación de dependencias vía Agente Legal
    const deps = await legalAgent.checkLegalDependencies(id);
    if (deps.blocked) {
      return {
        ok:          false,
        error:       "Borrado físico bloqueado por el Agente Legal.",
        vetoReasons: deps.reasons,
      };
    }

    // SHA-256(fiscal_id|fiscal_id_tipo) — sin PII en el log (RGPD Art.17)
    const hashInput = `${contacto.fiscal_id ?? ""}|${contacto.fiscal_id_tipo ?? "UNKNOWN"}`;
    const hash_identificador = createHash("sha256").update(hashInput).digest("hex");

    // AuditLog(FORGET) ANTES de mutar — REGLA CISO — SIN PII
    await contactoRepository.appendAuditLog({
      table_name:         "contactos",
      record_id:          id,
      action:             "FORGET",
      // RGPD: sin PII en el log de borrado — omitir campos en lugar de null
      hash_identificador,
      base_legal:         "Pass Away manual — Guardian Dashboard. RGPD Art.17 / Prescripción art.70 GILF.",
      meta_counts: {
        contactos:         1,
        expedientes:       deps.expedientes,
        facturas:          deps.facturas_pendientes,
        documentos_drive:  deps.documentos_drive,
      },
      purgeable:          true,
      notes:              "[FORGET] Borrado físico manual ejecutado por Administrador. Hash verificable sin PII.",
    });

    // Borrado atómico: company_links primero (FK sin onDelete:Cascade), luego contacto
    await prisma.$transaction([
      prisma.contactoCompanyLink.deleteMany({ where: { contacto_id: id } }),
      prisma.contacto.delete({ where: { id } }),
    ]);

    revalidatePath("/admin/cuarentena");
    revalidatePath("/contactos", "layout");
    return { ok: true, hash_identificador };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al ejecutar Pass Away.";
    console.error("[passAwayContacto]", message);
    return { ok: false, error: message };
  }
}

// ─── toggleIsActive ───────────────────────────────────────────────────────────

export type ToggleIsActiveResult =
  | { ok: true; is_active: boolean }
  | { ok: false; error: string };

/**
 * Alterna el flag comercial is_active de un Contacto.
 * INDEPENDIENTE del ciclo legal (ACTIVE/QUARANTINE/FORGOTTEN).
 * false = oculto del Directorio activo; datos íntegros.
 */
export async function toggleIsActive(id: string): Promise<ToggleIsActiveResult> {
  try {
    const current = await prisma.contacto.findUnique({
      where: { id },
      select: { is_active: true },
    });
    if (!current) return { ok: false, error: `Contacto no encontrado (${id}).` };

    const updated = await prisma.contacto.update({
      where: { id },
      data: { is_active: !current.is_active },
      select: { is_active: true },
    });

    revalidatePath("/contactos", "layout");
    revalidatePath("/");
    return { ok: true, is_active: updated.is_active };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al cambiar el estado del Contacto.";
    console.error("[toggleIsActive]", message);
    return { ok: false, error: message };
  }
}

// ─── toggleEsCliente ──────────────────────────────────────────────────────────

export type ToggleEsClienteResult =
  | { ok: true; es_cliente: boolean }
  | { ok: false; error: string };

/**
 * Alterna el atributo comercial es_cliente.
 *
 * FILOSOFÍA DE DATOS: es_cliente es un ATRIBUTO ADICIONAL, no un tipo excluyente.
 * Un contacto puede ser Cliente y Pre-cliente simultáneamente (ej: cliente de
 * contabilidad y pre-cliente de una herencia). Solo es_facturadora mantiene
 * veto de exclusividad por seguridad contable.
 */
export async function toggleEsCliente(id: string): Promise<ToggleEsClienteResult> {
  try {
    const current = await prisma.contacto.findUnique({
      where:  { id },
      select: { es_cliente: true },
    });
    if (!current) return { ok: false, error: `Contacto no encontrado (${id}).` };

    const updated = await prisma.contacto.update({
      where:  { id },
      data:   { es_cliente: !current.es_cliente },
      select: { es_cliente: true },
    });

    revalidatePath("/contactos", "layout");
    return { ok: true, es_cliente: updated.es_cliente };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cambiar rol de cliente.";
    console.error("[toggleEsCliente]", message);
    return { ok: false, error: message };
  }
}

// ─── toggleEsPrecliente ───────────────────────────────────────────────────────

export type ToggleEsPreClienteResult =
  | { ok: true; es_precliente: boolean }
  | { ok: false; error: string };

/**
 * Alterna el atributo comercial es_precliente.
 *
 * FILOSOFÍA DE DATOS: es_precliente es un ATRIBUTO ADICIONAL, no un tipo excluyente.
 * Puede coexistir con es_cliente (ej: cliente de contabilidad y pre-cliente de herencia).
 * Solo es_facturadora mantiene veto de exclusividad por seguridad contable.
 */
export async function toggleEsPrecliente(id: string): Promise<ToggleEsPreClienteResult> {
  try {
    const current = await prisma.contacto.findUnique({
      where:  { id },
      select: { es_precliente: true },
    });
    if (!current) return { ok: false, error: `Contacto no encontrado (${id}).` };

    const updated = await prisma.contacto.update({
      where:  { id },
      data:   { es_precliente: !current.es_precliente },
      select: { es_precliente: true },
    });

    revalidatePath("/contactos", "layout");
    return { ok: true, es_precliente: updated.es_precliente };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cambiar estado pre-cliente.";
    console.error("[toggleEsPrecliente]", message);
    return { ok: false, error: message };
  }
}

// ─── toggleEsFacturadora ──────────────────────────────────────────────────────

export type ToggleEsFacturadoraResult =
  | { ok: true; es_facturadora: boolean; es_cliente: boolean; es_precliente: boolean }
  | { ok: false; error: string };

/**
 * Alterna el flag es_facturadora (Entidad Matriz / Facturadora).
 *
 * EXCLUSIVIDAD ATÓMICA:
 *   Activar Matriz desactiva es_cliente y es_precliente simultáneamente.
 *   Una Matriz no puede ser Cliente ni Pre-cliente (previene autofacturación).
 *
 * VETO DE DESACTIVACIÓN:
 *   Si el fiscal_id está en BRAINLEX_MATRIZ_CIFS, la desactivación es rechazada.
 *   Solo se puede desactivar cuando el CIF no esté en la env var.
 */
export async function toggleEsFacturadora(id: string): Promise<ToggleEsFacturadoraResult> {
  try {
    const current = await prisma.contacto.findUnique({
      where:  { id },
      select: { es_facturadora: true, es_cliente: true, es_precliente: true, fiscal_id: true },
    });
    if (!current) return { ok: false, error: `Contacto no encontrado (${id}).` };

    const newEsFacturadora = !current.es_facturadora;

    // VETO: CIF protegido por env var — no se puede desactivar manualmente
    if (!newEsFacturadora && isMatrizCif(current.fiscal_id)) {
      return {
        ok:    false,
        error: "Esta entidad es una Matriz configurada por el sistema (BRAINLEX_MATRIZ_CIFS). Para desactivarla retira el CIF de la variable de entorno y reinicia el servidor.",
      };
    }

    const updated = await prisma.contacto.update({
      where: { id },
      data: {
        es_facturadora: newEsFacturadora,
        // Exclusividad atómica: Matriz no puede ser Cliente ni Pre-cliente
        ...(newEsFacturadora && { es_cliente: false, es_precliente: false }),
      },
      select: { es_facturadora: true, es_cliente: true, es_precliente: true },
    });

    revalidatePath("/contactos", "layout");
    return {
      ok:             true,
      es_facturadora: updated.es_facturadora,
      es_cliente:     updated.es_cliente,
      es_precliente:  updated.es_precliente,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cambiar estado de facturadora.";
    console.error("[toggleEsFacturadora]", message);
    return { ok: false, error: message };
  }
}

// ─── toggleFavoritePhone ──────────────────────────────────────────────────────

export type ToggleFavoritePhoneResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Marca un canal de tipo TELEFONO como favorito para su Contacto.
 *
 * Flujo atómico:
 *   1. Unset es_favorito en todos los canales TELEFONO del Contacto con el
 *      mismo subtipo (MOVIL ó FIJO) para garantizar unicidad del favorito.
 *   2. Set es_favorito=true en el canal solicitado.
 *   3. Sincroniza el caché denormalizado en Contacto.telefono_movil / fijo
 *      (O(1) en el Directorio sin joins).
 *
 * La sincronización se limita al subtipo del canal modificado para no
 * sobrescribir el caché del otro subtipo.
 */
export async function toggleFavoritePhone(
  canalId: string,
  contactoId: string
): Promise<ToggleFavoritePhoneResult> {
  try {
    const canal = await prisma.canalComunicacion.findUnique({
      where: { id: canalId },
      select: { tipo: true, subtipo: true, valor: true, contactoId: true },
    });

    if (!canal) return { ok: false, error: `Canal no encontrado (${canalId}).` };
    if (canal.contactoId !== contactoId)
      return { ok: false, error: "El canal no pertenece a este Contacto." };
    if (canal.tipo !== "TELEFONO")
      return { ok: false, error: "Solo se puede marcar como favorito un canal TELEFONO." };

    const subtipo = canal.subtipo ?? "MOVIL";

    await prisma.$transaction(async (tx) => {
      // 1. Desmarcar favorito anterior del mismo subtipo
      await tx.canalComunicacion.updateMany({
        where: {
          contactoId,
          tipo:       "TELEFONO",
          subtipo,
          es_favorito: true,
        },
        data: { es_favorito: false },
      });

      // 2. Marcar el nuevo favorito
      await tx.canalComunicacion.update({
        where: { id: canalId },
        data:  { es_favorito: true },
      });

      // 3. Sincronizar caché denormalizado en la tabla principal
      const cacheField =
        subtipo === "FIJO" ? "telefono_fijo" : "telefono_movil";

      await tx.contacto.update({
        where: { id: contactoId },
        data:  { [cacheField]: canal.valor },
      });
    });

    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al actualizar el teléfono favorito.";
    console.error("[toggleFavoritePhone]", message);
    return { ok: false, error: message };
  }
}

// ─── searchInQuarantine ───────────────────────────────────────────────────────

export type QuarantineHit = {
  id:       string;
  name:     string;
  fiscal_id: string | null;
};

export type SearchInQuarantineResult =
  | { ok: true;  hit: QuarantineHit | null }
  | { ok: false; error: string };

/**
 * "Visión de Rayos X" — busca en contactos QUARANTINE sin tocar la lista activa.
 * Solo se llama cuando el buscador del directorio no encuentra resultados activos.
 * Busca por fiscal_id (insensible a mayúsculas), nombre completo, razón social o email.
 */
export async function searchInQuarantine(
  query: string
): Promise<SearchInQuarantineResult> {
  const q = query.trim();
  if (q.length < 3) return { ok: true, hit: null };

  try {
    const found = await prisma.contacto.findFirst({
      where: {
        status: "QUARANTINE",
        OR: [
          { fiscal_id:      { contains: q,              mode: "insensitive" } },
          { razon_social:   { contains: q,              mode: "insensitive" } },
          { nombre:         { contains: q,              mode: "insensitive" } },
          { apellido1:      { contains: q,              mode: "insensitive" } },
          { email_principal:{ contains: q.toLowerCase(), mode: "insensitive" } },
        ],
      },
      select: {
        id:           true,
        nombre:       true,
        apellido1:    true,
        razon_social: true,
        fiscal_id:    true,
        fiscal_id_tipo: true,
      },
    });

    if (!found) return { ok: true, hit: null };

    const name =
      found.razon_social ||
      [found.nombre, found.apellido1].filter(Boolean).join(" ") ||
      "—";
    const fiscal_id = found.fiscal_id
      ? `${found.fiscal_id_tipo ?? ""} ${found.fiscal_id}`.trim()
      : null;

    return { ok: true, hit: { id: found.id, name, fiscal_id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al buscar en cuarentena.";
    console.error("[searchInQuarantine]", message);
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
