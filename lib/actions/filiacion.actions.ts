// ============================================================================
// lib/actions/filiacion.actions.ts — Server Actions: Direcciones y Canales
//
// @role: Agente de Backend (controlador delgado)
// @spec: Micro-Spec 2.7 — CRUD + formateo robusto backend + libphonenumber
// ============================================================================
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { prisma } from "@/lib/prisma";

// ─── Result type ──────────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; errors: Partial<Record<string, string[]>> };

// ─── Helpers de formateo (aplicados en el backend antes del INSERT) ───────────

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());

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
  es_principal: z.boolean().default(false),
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
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  // ── Formateo robusto aplicado DESPUÉS de validación, ANTES del INSERT ──────
  const data = {
    ...parsed.data,
    etiqueta:      parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : undefined,
    calle:         toTitleCase(parsed.data.calle),
    calle_2:       parsed.data.calle_2  ? toTitleCase(parsed.data.calle_2)  : undefined,
    ciudad:        parsed.data.ciudad    ? toTitleCase(parsed.data.ciudad)    : undefined,
    provincia:     parsed.data.provincia ? toTitleCase(parsed.data.provincia) : undefined,
    codigo_postal: parsed.data.codigo_postal
      ? toUpperTrim(parsed.data.codigo_postal)
      : undefined,
  };

  await prisma.$transaction(async (tx) => {
    if (data.es_principal) {
      await tx.direccion.updateMany({
        where: { contactoId: data.contactoId, es_principal: true },
        data:  { es_principal: false },
      });
    }
    await tx.direccion.create({ data });
  });
  revalidatePath(`/contactos/${data.contactoId}`);
  return { success: true };
}

// ─── eliminarDireccion ────────────────────────────────────────────────────────

export async function eliminarDireccion(
  id: string,
  contactoId: string,
): Promise<void> {
  await prisma.direccion.delete({ where: { id } });
  revalidatePath(`/contactos/${contactoId}`);
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
    es_principal: formData.get("es_principal") === "on",
  };

  const parsed = CanalSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  // ── Formateo robusto: etiqueta en MAYÚSCULAS ──────────────────────────────
  const data = {
    ...parsed.data,
    etiqueta: parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : undefined,
  };

  await prisma.$transaction(async (tx) => {
    if (data.es_principal) {
      await tx.canalComunicacion.updateMany({
        where: { contactoId: data.contactoId, es_principal: true },
        data:  { es_principal: false },
      });
    }
    await tx.canalComunicacion.create({ data });
  });
  revalidatePath(`/contactos/${data.contactoId}`);
  return { success: true };
}

// ─── eliminarCanal ────────────────────────────────────────────────────────────

export async function eliminarCanal(
  id: string,
  contactoId: string,
): Promise<void> {
  await prisma.canalComunicacion.delete({ where: { id } });
  revalidatePath(`/contactos/${contactoId}`);
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
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = {
    tipo:          parsed.data.tipo,
    etiqueta:      parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : null,
    calle:         toTitleCase(parsed.data.calle),
    calle_2:       parsed.data.calle_2  ? toTitleCase(parsed.data.calle_2)  : null,
    ciudad:        parsed.data.ciudad    ? toTitleCase(parsed.data.ciudad)    : null,
    provincia:     parsed.data.provincia ? toTitleCase(parsed.data.provincia) : null,
    codigo_postal: parsed.data.codigo_postal ? toUpperTrim(parsed.data.codigo_postal) : null,
    pais:          parsed.data.pais,
    es_principal:  parsed.data.es_principal,
  };

  await prisma.$transaction(async (tx) => {
    if (data.es_principal) {
      await tx.direccion.updateMany({
        where: { contactoId, es_principal: true, NOT: { id } },
        data:  { es_principal: false },
      });
    }
    await tx.direccion.update({ where: { id }, data });
  });
  revalidatePath(`/contactos/${contactoId}`);
  return { success: true };
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
    es_principal: formData.get("es_principal") === "on",
  };

  const parsed = CanalUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = {
    tipo:         parsed.data.tipo,
    valor:        parsed.data.valor,
    etiqueta:     parsed.data.etiqueta ? toUpperTrim(parsed.data.etiqueta) : null,
    es_principal: parsed.data.es_principal,
  };

  await prisma.$transaction(async (tx) => {
    if (data.es_principal) {
      await tx.canalComunicacion.updateMany({
        where: { contactoId, es_principal: true, NOT: { id } },
        data:  { es_principal: false },
      });
    }
    await tx.canalComunicacion.update({ where: { id }, data });
  });
  revalidatePath(`/contactos/${contactoId}`);
  return { success: true };
}
