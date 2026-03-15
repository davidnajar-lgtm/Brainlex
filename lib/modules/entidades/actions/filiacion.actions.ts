// ============================================================================
// lib/modules/entidades/actions/filiacion.actions.ts — Server Actions: Direcciones y Canales
//
// @role: Agente de Backend (controlador delgado)
// @spec: Micro-Spec 2.7 — CRUD + formateo robusto backend + libphonenumber
// ============================================================================
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/utils/normalizeAddress";

// ─── Result type ──────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string[]>> };

// ─── @Scope-Guard: Validación multitenant para operaciones de filiación ─────

/**
 * REGLA CISO — Protección multitenant:
 * Verifica que el contacto está vinculado al tenant solicitante antes
 * de permitir operaciones de creación/edición/eliminación de direcciones y canales.
 * Sin companyId (SuperAdmin) → permitido.
 */
async function assertTenantAccess(
  contactoId: string,
  companyId: string | null | undefined,
): Promise<{ allowed: true } | { allowed: false; result: ActionResult }> {
  if (!companyId) return { allowed: true };

  const linkCount = await prisma.contactoCompanyLink.count({
    where: { contacto_id: contactoId, company_id: companyId },
  });

  if (linkCount === 0) {
    return {
      allowed: false,
      result: {
        ok: false,
        error: `El contacto no está vinculado a ${companyId}. Operación denegada.`,
      },
    };
  }

  return { allowed: true };
}

// ─── Helpers de formateo (aplicados en el backend antes del INSERT) ───────────

const toUpperTrim = (str: string) => str.toUpperCase().trim();

// ─── Helpers internos ─────────────────────────────────────────────────────────

const TIPOS_TELEFONO = new Set(["TELEFONO", "FAX", "WHATSAPP"]);

// ─── Refinement: CP condicional por país (compartido entre create y update) ───

function validateCP(
  data: { codigo_postal?: string; pais: string },
  ctx: z.RefinementCtx,
) {
  if (!data.codigo_postal) return;
  const cp = data.codigo_postal.toUpperCase();
  if (data.pais === "ES") {
    if (!/^\d{5}$/.test(cp)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["codigo_postal"],
        message: "El CP español debe ser de 5 dígitos numéricos (ej: 28001)",
      });
    }
  } else {
    if (!/^[A-Z0-9]([A-Z0-9 \-]{0,8}[A-Z0-9])?$/.test(cp)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["codigo_postal"],
        message: "Código postal inválido (solo letras, números, espacios y guiones)",
      });
    }
  }
}

// ─── Refinement: valor de canal condicional por tipo ─────────────────────────

function validateCanalValor(
  data: { tipo: string; valor: string },
  ctx: z.RefinementCtx,
) {
  if (TIPOS_TELEFONO.has(data.tipo)) {
    try {
      if (!isValidPhoneNumber(data.valor)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valor"], message: "Número inválido. Incluye el prefijo internacional (ej: +34 600 000 000)" });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valor"], message: "Número inválido. Incluye el prefijo internacional (ej: +34 600 000 000)" });
    }
  } else if (data.tipo === "EMAIL") {
    if (!z.string().email().safeParse(data.valor).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valor"], message: "Dirección de email inválida" });
    }
  } else if (data.tipo === "WEB") {
    if (!z.string().url().safeParse(data.valor).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valor"], message: "URL inválida. Debe comenzar con https://" });
    }
  }
}

// ─── Schemas base (sin contactoId) — reutilizados en create y update ─────────

const DireccionFieldsSchema = z.object({
  tipo:          z.enum(["FISCAL", "DOMICILIO_SOCIAL", "WORKPLACE", "OTRO"]),
  etiqueta:      z.string().optional(),
  calle:         z.string().min(1, "La calle es obligatoria"),
  calle_2:       z.string().optional(),
  codigo_postal: z.string().optional(),
  ciudad:        z.string().optional(),
  provincia:     z.string().optional(),
  pais:          z
    .string()
    .length(2, "El código de país debe tener 2 letras (ISO 3166-1)")
    .default("ES")
    .transform((v) => v.toUpperCase()),
  es_principal:  z.boolean().default(false),
});

const CanalFieldsSchema = z.object({
  tipo:         z.enum(["TELEFONO", "EMAIL", "WEB", "LINKEDIN", "WHATSAPP", "FAX", "OTRA"]),
  valor:        z.string().min(1, "El valor es obligatorio"),
  etiqueta:     z.string().optional(),
  subtipo:      z.string().optional(),
  es_principal: z.boolean().default(false),
  es_favorito:  z.boolean().default(false),
});

// ─── Schemas de CREATE (añaden contactoId) ────────────────────────────────────

const DireccionSchema      = DireccionFieldsSchema.extend({ contactoId: z.string().cuid("ID de contacto inválido") }).superRefine(validateCP);
const CanalSchema          = CanalFieldsSchema.extend({ contactoId: z.string().cuid("ID de contacto inválido") }).superRefine(validateCanalValor);

// ─── Schemas de UPDATE (sin contactoId — viene como parámetro bind) ───────────

const DireccionUpdateSchema = DireccionFieldsSchema.superRefine(validateCP);
const CanalUpdateSchema     = CanalFieldsSchema.superRefine(validateCanalValor);

// ─── crearDireccion ───────────────────────────────────────────────────────────

export async function crearDireccion(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    contactoId:    formData.get("contactoId"),
    tipo:          formData.get("tipo"),
    etiqueta:      formData.get("etiqueta")?.toString().trim() || undefined,
    calle:         formData.get("calle"),
    calle_2:       formData.get("calle_2")?.toString().trim()        || undefined,
    codigo_postal: formData.get("codigo_postal")?.toString().trim() || undefined,
    ciudad:        formData.get("ciudad")?.toString().trim()        || undefined,
    provincia:     formData.get("provincia")?.toString().trim()     || undefined,
    pais:          formData.get("pais")?.toString().trim()          || "ES",
    es_principal:  formData.get("es_principal") === "on",
  };

  const parsed = DireccionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Errores de validación", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // REGLA CISO — Protección multitenant
  const companyId = formData.get("companyId")?.toString() || null;
  const access = await assertTenantAccess(parsed.data.contactoId, companyId);
  if (!access.allowed) return access.result;

  // ── Formateo robusto aplicado DESPUÉS de validación, ANTES del INSERT ──────
  const data = {
    ...parsed.data,
    etiqueta:      parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : undefined,
    calle:         normalizeAddress(parsed.data.calle),
    calle_2:       parsed.data.calle_2  ? normalizeAddress(parsed.data.calle_2)  : undefined,
    ciudad:        parsed.data.ciudad    ? normalizeAddress(parsed.data.ciudad)    : undefined,
    provincia:     parsed.data.provincia ? normalizeAddress(parsed.data.provincia) : undefined,
    codigo_postal: parsed.data.codigo_postal
      ? toUpperTrim(parsed.data.codigo_postal)
      : undefined,
  };

  await prisma.$transaction(async (tx) => {
    // REGLA CISO L3 — AuditLog ANTES de mutar
    await tx.auditLog.create({
      data: {
        action: "CREATE",
        table_name: "direcciones",
        record_id: data.contactoId,
        old_data: Prisma.JsonNull,
        new_data: { section: "direccion", ...data } as unknown as Prisma.InputJsonValue,
      },
    });

    if (data.es_principal) {
      await tx.direccion.updateMany({
        where: { contactoId: data.contactoId, es_principal: true },
        data:  { es_principal: false },
      });
    }
    await tx.direccion.create({ data });
  });
  revalidatePath(`/contactos/${data.contactoId}`);
  return { ok: true };
}

// ─── eliminarDireccion ────────────────────────────────────────────────────────

export async function eliminarDireccion(
  id: string,
  contactoId: string,
  companyId?: string | null,
): Promise<ActionResult> {
  try {
    // REGLA CISO — Protección multitenant
    const access = await assertTenantAccess(contactoId, companyId);
    if (!access.allowed) return access.result;

    // REGLA CISO L3 — AuditLog ANTES de mutar
    const before = await prisma.direccion.findUnique({ where: { id } });

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          table_name: "direcciones",
          record_id: contactoId,
          old_data: before as unknown as Prisma.InputJsonValue,
          new_data: { section: "direccion", deleted_id: id } as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.direccion.delete({ where: { id } });
    });
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true };
  } catch (err) {
    console.error("[eliminarDireccion] Error:", err);
    return { ok: false, error: "Error al eliminar la dirección." };
  }
}

// ─── crearCanal ───────────────────────────────────────────────────────────────

export async function crearCanal(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    contactoId:   formData.get("contactoId"),
    tipo:         formData.get("tipo"),
    valor:        formData.get("valor"),
    etiqueta:     formData.get("etiqueta")?.toString().trim() || undefined,
    subtipo:      formData.get("subtipo")?.toString() || undefined,
    es_principal: formData.get("es_principal") === "on",
    es_favorito:  formData.get("es_favorito") === "on",
  };

  const parsed = CanalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Errores de validación", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // REGLA CISO — Protección multitenant
  const companyId = formData.get("companyId")?.toString() || null;
  const access = await assertTenantAccess(parsed.data.contactoId, companyId);
  if (!access.allowed) return access.result;

  // ── Formateo robusto: etiqueta en MAYÚSCULAS ──────────────────────────────
  const data = {
    ...parsed.data,
    etiqueta: parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : undefined,
  };

  await prisma.$transaction(async (tx) => {
    // REGLA CISO L3 — AuditLog ANTES de mutar
    await tx.auditLog.create({
      data: {
        action: "CREATE",
        table_name: "canales_comunicacion",
        record_id: data.contactoId,
        old_data: Prisma.JsonNull,
        new_data: { section: "canal", ...data } as unknown as Prisma.InputJsonValue,
      },
    });

    // TAREA 3: primer canal de este tipo → favorito automático
    const existingCount = await tx.canalComunicacion.count({
      where: { contactoId: data.contactoId, tipo: data.tipo },
    });
    const esFavorito = data.es_favorito || existingCount === 0;

    if (data.es_principal) {
      await tx.canalComunicacion.updateMany({
        where: { contactoId: data.contactoId, es_principal: true },
        data:  { es_principal: false },
      });
    }
    if (esFavorito) {
      await tx.canalComunicacion.updateMany({
        where: { contactoId: data.contactoId, tipo: data.tipo, es_favorito: true },
        data:  { es_favorito: false },
      });
    }

    await tx.canalComunicacion.create({ data: { ...data, es_favorito: esFavorito } });

    // TAREA 1: sync caché de la tabla principal
    const cacheUpdate: Record<string, string> = {};
    if (esFavorito && data.tipo === "TELEFONO") {
      if (data.subtipo === "FIJO") {
        cacheUpdate.telefono_fijo = data.valor;
      } else {
        cacheUpdate.telefono_movil = data.valor;
      }
    } else if (data.es_principal && data.tipo === "EMAIL") {
      cacheUpdate.email_principal = data.valor;
    }

    // Auto canal_preferido: si el contacto no tiene canal preferido definido,
    // establecerlo automáticamente al tipo del primer canal relevante
    if (existingCount === 0) {
      const contacto = await tx.contacto.findUnique({
        where: { id: data.contactoId },
        select: { canal_preferido: true },
      });
      if (!contacto?.canal_preferido) {
        if (data.tipo === "EMAIL") cacheUpdate.canal_preferido = "EMAIL";
        else if (data.tipo === "TELEFONO" || data.tipo === "WHATSAPP") cacheUpdate.canal_preferido = "MOVIL";
      }
    }

    if (Object.keys(cacheUpdate).length > 0) {
      await tx.contacto.update({ where: { id: data.contactoId }, data: cacheUpdate });
    }
  });
  revalidatePath(`/contactos/${data.contactoId}`);
  return { ok: true };
}

// ─── eliminarCanal ────────────────────────────────────────────────────────────

export async function eliminarCanal(
  id: string,
  contactoId: string,
  companyId?: string | null,
): Promise<ActionResult> {
  try {
    // REGLA CISO — Protección multitenant
    const access = await assertTenantAccess(contactoId, companyId);
    if (!access.allowed) return access.result;

    // REGLA CISO L3 — AuditLog ANTES de mutar
    const before = await prisma.canalComunicacion.findUnique({ where: { id } });

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          table_name: "canales_comunicacion",
          record_id: contactoId,
          old_data: before as unknown as Prisma.InputJsonValue,
          new_data: { section: "canal", deleted_id: id } as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.canalComunicacion.delete({ where: { id } });
    });
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true };
  } catch (err) {
    console.error("[eliminarCanal] Error:", err);
    return { ok: false, error: "Error al eliminar el canal." };
  }
}

// ─── editarDireccion ──────────────────────────────────────────────────────────

export async function editarDireccion(
  id: string,
  contactoId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    tipo:          formData.get("tipo"),
    etiqueta:      formData.get("etiqueta")?.toString().trim() || undefined,
    calle:         formData.get("calle"),
    calle_2:       formData.get("calle_2")?.toString().trim()        || undefined,
    codigo_postal: formData.get("codigo_postal")?.toString().trim() || undefined,
    ciudad:        formData.get("ciudad")?.toString().trim()        || undefined,
    provincia:     formData.get("provincia")?.toString().trim()     || undefined,
    pais:          formData.get("pais")?.toString().trim()          || "ES",
    es_principal:  formData.get("es_principal") === "on",
  };

  const parsed = DireccionUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Errores de validación", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // REGLA CISO — Protección multitenant
  const companyId = formData.get("companyId")?.toString() || null;
  const access = await assertTenantAccess(contactoId, companyId);
  if (!access.allowed) return access.result;

  const data = {
    tipo:          parsed.data.tipo,
    etiqueta:      parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : null,
    calle:         normalizeAddress(parsed.data.calle),
    calle_2:       parsed.data.calle_2  ? normalizeAddress(parsed.data.calle_2)  : null,
    ciudad:        parsed.data.ciudad    ? normalizeAddress(parsed.data.ciudad)    : null,
    provincia:     parsed.data.provincia ? normalizeAddress(parsed.data.provincia) : null,
    codigo_postal: parsed.data.codigo_postal ? toUpperTrim(parsed.data.codigo_postal) : null,
    pais:          parsed.data.pais,
    es_principal:  parsed.data.es_principal,
  };

  // REGLA CISO L3 — AuditLog: capturar estado previo
  const before = await prisma.direccion.findUnique({ where: { id } });

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        table_name: "direcciones",
        record_id: contactoId,
        old_data: before as unknown as Prisma.InputJsonValue,
        new_data: { section: "direccion", ...data } as unknown as Prisma.InputJsonValue,
      },
    });

    if (data.es_principal) {
      await tx.direccion.updateMany({
        where: { contactoId, es_principal: true, NOT: { id } },
        data:  { es_principal: false },
      });
    }
    await tx.direccion.update({ where: { id }, data });
  });
  revalidatePath(`/contactos/${contactoId}`);
  return { ok: true };
}

// ─── editarCanal ──────────────────────────────────────────────────────────────

export async function editarCanal(
  id: string,
  contactoId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    tipo:         formData.get("tipo"),
    valor:        formData.get("valor"),
    etiqueta:     formData.get("etiqueta")?.toString().trim() || undefined,
    subtipo:      formData.get("subtipo")?.toString() || undefined,
    es_principal: formData.get("es_principal") === "on",
    es_favorito:  formData.get("es_favorito") === "on",
  };

  const parsed = CanalUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Errores de validación", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // REGLA CISO — Protección multitenant
  const companyId = formData.get("companyId")?.toString() || null;
  const access = await assertTenantAccess(contactoId, companyId);
  if (!access.allowed) return access.result;

  const data = {
    tipo:         parsed.data.tipo,
    valor:        parsed.data.valor,
    etiqueta:     parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : null,
    subtipo:      parsed.data.subtipo ?? null,
    es_principal: parsed.data.es_principal,
    es_favorito:  parsed.data.es_favorito,
  };

  // REGLA CISO L3 — AuditLog: capturar estado previo
  const before = await prisma.canalComunicacion.findUnique({ where: { id } });

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        table_name: "canales_comunicacion",
        record_id: contactoId,
        old_data: before as unknown as Prisma.InputJsonValue,
        new_data: { section: "canal", ...data } as unknown as Prisma.InputJsonValue,
      },
    });

    if (data.es_principal) {
      await tx.canalComunicacion.updateMany({
        where: { contactoId, es_principal: true, NOT: { id } },
        data:  { es_principal: false },
      });
    }
    if (data.es_favorito) {
      await tx.canalComunicacion.updateMany({
        where: { contactoId, tipo: data.tipo, es_favorito: true, NOT: { id } },
        data:  { es_favorito: false },
      });
    }
    await tx.canalComunicacion.update({ where: { id }, data });

    // TAREA 1: sync caché de la tabla principal
    if (data.es_favorito && data.tipo === "TELEFONO") {
      if (data.subtipo === "FIJO") {
        await tx.contacto.update({ where: { id: contactoId }, data: { telefono_fijo: data.valor } });
      } else {
        await tx.contacto.update({ where: { id: contactoId }, data: { telefono_movil: data.valor } });
      }
    } else if (data.es_principal && data.tipo === "EMAIL") {
      await tx.contacto.update({ where: { id: contactoId }, data: { email_principal: data.valor } });
    }
  });
  revalidatePath(`/contactos/${contactoId}`);
  return { ok: true };
}
