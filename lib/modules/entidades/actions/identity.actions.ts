// ============================================================================
// lib/modules/entidades/actions/identity.actions.ts
//
// @role: Agente de Backend (controlador delgado)
// @spec: Fase 9.1 — Server Actions para edición de identidad y canales directos
//
// updateIdentity       — PF: nombre, apellido1, apellido2, fiscal_id, notas
//                        PJ: razon_social, tipo_sociedad, fiscal_id, notas
// updateDirectChannels — email, teléfonos (E.164), website, linkedin, canal_preferido
// ============================================================================
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FiscalIdTipo, ContactoTipo, Prisma } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { prisma } from "@/lib/prisma";
import { isMatrizCif } from "@/lib/modules/entidades/config/matrizConfig";

// ─── Result type (mismo patrón que filiacion.actions.ts) ─────────────────────

export type IdentityActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string[]>> }
  | { ok: false; error: string; conflictType: "NIF_CONFLICT"; conflictContactoName: string };

export type ChannelsActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string[]>> };

// ─── @Scope-Guard: Validación multitenant ─────────────────────────────────────

async function assertTenantAccess(
  contactoId: string,
  companyId: string | null | undefined,
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  if (!companyId) return { allowed: true };

  const linkCount = await prisma.contactoCompanyLink.count({
    where: { contacto_id: contactoId, company_id: companyId },
  });

  if (linkCount === 0) {
    return {
      allowed: false,
      error: `El contacto no está vinculado a ${companyId}. Operación denegada.`,
    };
  }

  return { allowed: true };
}

// ─── Zod schema: Identity update ──────────────────────────────────────────────

// Whitelists per tipo (imported from schema, duplicated here for server-only)
const PF_FISCAL_ID_TIPOS = new Set<FiscalIdTipo>([
  FiscalIdTipo.NIF, FiscalIdTipo.DNI, FiscalIdTipo.NIE, FiscalIdTipo.PASAPORTE,
  FiscalIdTipo.TIE, FiscalIdTipo.VAT, FiscalIdTipo.K, FiscalIdTipo.L,
  FiscalIdTipo.M, FiscalIdTipo.CODIGO_SOPORTE, FiscalIdTipo.SIN_REGISTRO,
]);

const PJ_FISCAL_ID_TIPOS = new Set<FiscalIdTipo>([
  FiscalIdTipo.NIF, FiscalIdTipo.CIF, FiscalIdTipo.VAT, FiscalIdTipo.SIN_REGISTRO,
]);

// Regex patterns for fiscal ID validation (same as contacto.schema.ts)
const RE = {
  DNI: /^[0-9]{8}[A-Z]$/i,
  NIE: /^[XYZ][0-9]{7}[A-Z]$/i,
  CIF: /^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/i,
  NIF: /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J])$/i,
  VAT: /^[A-Z]{2}[A-Z0-9]{2,12}$/i,
  TIE: /^[A-Z][0-9]{7}[A-Z0-9]$/i,
  PASAPORTE: /^[A-Z0-9]{6,20}$/i,
  KLM: /^[KLM][A-Z0-9]{7}[A-Z]$/i,
  GENERIC: /^[A-Z0-9\-\s]{3,30}$/i,
} as const;

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
function checkDni(id: string): boolean {
  const n = parseInt(id.slice(0, 8), 10);
  if (isNaN(n)) return false;
  return id[8]?.toUpperCase() === DNI_LETTERS[n % 23];
}
function checkNie(id: string): boolean {
  const map: Record<string, string> = { X: "0", Y: "1", Z: "2" };
  const prefix = map[id[0]?.toUpperCase()];
  if (!prefix) return false;
  return checkDni(prefix + id.slice(1));
}
const CIF_MUST_LETTER = new Set(["P", "Q", "R", "S", "W"]);
const CIF_MUST_DIGIT  = new Set(["A", "B", "E", "H"]);
const CIF_LETTERS = "JABCDEFGHI";
function checkCif(id: string): boolean {
  const orgType = id[0]?.toUpperCase();
  const digits  = id.slice(1, 8);
  const last    = id[8]?.toUpperCase();
  let sumOdd = 0, sumEven = 0;
  for (let i = 0; i < 7; i++) {
    const d = parseInt(digits[i]);
    if ((i + 1) % 2 !== 0) { const v = d * 2; sumOdd += v > 9 ? v - 9 : v; }
    else { sumEven += d; }
  }
  const total   = (sumOdd + sumEven) % 10;
  const control = total === 0 ? 0 : 10 - total;
  const expLetter = CIF_LETTERS[control];
  const expDigit  = String(control);
  if (CIF_MUST_LETTER.has(orgType)) return last === expLetter;
  if (CIF_MUST_DIGIT.has(orgType))  return last === expDigit;
  return last === expLetter || last === expDigit;
}

function validateFiscalId(tipo: FiscalIdTipo, value: string): string | null {
  const id = value.trim().toUpperCase();
  switch (tipo) {
    case FiscalIdTipo.DNI:
      if (!RE.DNI.test(id)) return "DNI inválido: 8 dígitos + 1 letra.";
      if (!checkDni(id)) return "Letra de control incorrecta.";
      return null;
    case FiscalIdTipo.NIE:
      if (!RE.NIE.test(id)) return "NIE inválido: [X|Y|Z] + 7 dígitos + 1 letra.";
      if (!checkNie(id)) return "Letra de control incorrecta.";
      return null;
    case FiscalIdTipo.CIF:
      if (!RE.CIF.test(id)) return "CIF inválido.";
      if (!checkCif(id)) return "Carácter de control incorrecto.";
      return null;
    case FiscalIdTipo.NIF: {
      if (!RE.NIF.test(id)) return "NIF inválido.";
      if (/^[0-9]/.test(id)) { if (!checkDni(id)) return "Letra de control incorrecta."; }
      else if (/^[XYZ]/i.test(id)) { if (!checkNie(id)) return "Letra de control incorrecta."; }
      else { if (!checkCif(id)) return "Carácter de control incorrecto."; }
      return null;
    }
    case FiscalIdTipo.VAT:
      return RE.VAT.test(id) ? null : "VAT inválido: código ISO + 2-12 alfanuméricos.";
    case FiscalIdTipo.TIE:
      return RE.TIE.test(id) ? null : "TIE inválido.";
    case FiscalIdTipo.PASAPORTE:
      return RE.PASAPORTE.test(id) ? null : "Pasaporte inválido: 6-20 alfanuméricos.";
    case FiscalIdTipo.K:
    case FiscalIdTipo.L:
    case FiscalIdTipo.M:
      return RE.KLM.test(id) ? null : "Formato K/L/M inválido.";
    case FiscalIdTipo.REGISTRO_EXTRANJERO:
    case FiscalIdTipo.CODIGO_SOPORTE:
      return RE.GENERIC.test(id) ? null : "Identificador inválido: 3-30 alfanuméricos.";
    case FiscalIdTipo.SIN_REGISTRO:
      return null;
  }
}

const IdentitySchema = z
  .object({
    contactoId:     z.string().min(1),
    companyId:      z.string().min(1),
    tipo:           z.enum(ContactoTipo),
    nombre:         z.string().trim().max(100).transform(s => s.toUpperCase()).nullish(),
    apellido1:      z.string().trim().max(100).transform(s => s.toUpperCase()).nullish(),
    apellido2:      z.string().trim().max(100).transform(s => s.toUpperCase()).nullish(),
    razon_social:   z.string().trim().max(200).transform(s => s.toUpperCase()).nullish(),
    tipo_sociedad:  z.string().trim().max(50).nullish(),
    fiscal_id_tipo: z.enum(FiscalIdTipo),
    fiscal_id:      z.string().trim().default(""),
    notas:          z.string().nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === ContactoTipo.PERSONA_FISICA && !data.nombre) {
      ctx.addIssue({ code: "custom", message: "El nombre es obligatorio.", path: ["nombre"] });
    }
    if (data.tipo === ContactoTipo.PERSONA_JURIDICA && !data.razon_social) {
      ctx.addIssue({ code: "custom", message: "La razón social es obligatoria.", path: ["razon_social"] });
    }
    if (data.tipo === ContactoTipo.PERSONA_JURIDICA && !data.tipo_sociedad?.trim()) {
      ctx.addIssue({ code: "custom", message: "Debe indicar el tipo de sociedad.", path: ["tipo_sociedad"] });
    }
    // Whitelist check
    if (data.tipo === ContactoTipo.PERSONA_FISICA && !PF_FISCAL_ID_TIPOS.has(data.fiscal_id_tipo)) {
      ctx.addIssue({ code: "custom", message: "Tipo de ID fiscal no válido para PF.", path: ["fiscal_id_tipo"] });
    }
    if (data.tipo === ContactoTipo.PERSONA_JURIDICA && !PJ_FISCAL_ID_TIPOS.has(data.fiscal_id_tipo)) {
      ctx.addIssue({ code: "custom", message: "Tipo de ID fiscal no válido para PJ.", path: ["fiscal_id_tipo"] });
    }
    // fiscal_id required when not SIN_REGISTRO
    if (data.fiscal_id_tipo !== FiscalIdTipo.SIN_REGISTRO && !data.fiscal_id.trim()) {
      ctx.addIssue({ code: "custom", message: "El identificador fiscal es obligatorio.", path: ["fiscal_id"] });
      return;
    }
    const err = validateFiscalId(data.fiscal_id_tipo, data.fiscal_id);
    if (err) ctx.addIssue({ code: "custom", message: err, path: ["fiscal_id"] });
  });

// ─── updateIdentity ──────────────────────────────────────────────────────────

export async function updateIdentity(
  _prevState: IdentityActionResult | null,
  formData: FormData,
): Promise<IdentityActionResult> {
  // formData.get() returns null when the field is not in the DOM (e.g. PJ fields
  // hidden for PF). Convert null → undefined for Zod .nullish()/.optional().
  const str = (key: string) => (formData.get(key) as string | null) ?? undefined;
  const raw = {
    contactoId:     formData.get("contactoId")     as string,
    companyId:      formData.get("companyId")       as string,
    tipo:           formData.get("tipo")            as string,
    nombre:         str("nombre"),
    apellido1:      str("apellido1"),
    apellido2:      str("apellido2"),
    razon_social:   str("razon_social"),
    tipo_sociedad:  str("tipo_sociedad"),
    fiscal_id_tipo: formData.get("fiscal_id_tipo")  as string,
    fiscal_id:      (formData.get("fiscal_id") as string) ?? "",
    notas:          str("notas"),
  };

  const parsed = IdentitySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<string, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key]!.push(issue.message);
    }
    return { ok: false, error: "Hay campos con errores de validación.", fieldErrors };
  }

  const data = parsed.data;

  // Scope guard
  const access = await assertTenantAccess(data.contactoId, data.companyId);
  if (!access.allowed) return { ok: false, error: access.error };

  // Sanitize fiscal_id
  const fiscal_id =
    data.fiscal_id_tipo === FiscalIdTipo.SIN_REGISTRO
      ? null
      : data.fiscal_id.trim().toUpperCase();

  // NIF conflict detection (excluding current contact)
  if (fiscal_id && data.fiscal_id_tipo !== FiscalIdTipo.SIN_REGISTRO) {
    const existing = await prisma.contacto.findFirst({
      where: {
        fiscal_id,
        fiscal_id_tipo: data.fiscal_id_tipo,
        id: { not: data.contactoId },
        status: { in: ["ACTIVE", "QUARANTINE"] },
      },
      select: { id: true, nombre: true, apellido1: true, razon_social: true },
    });
    if (existing) {
      const name = existing.razon_social ||
        [existing.nombre, existing.apellido1].filter(Boolean).join(" ") ||
        "Contacto existente";
      return {
        ok: false,
        error: `Este identificador fiscal ya está registrado por "${name}".`,
        conflictType: "NIF_CONFLICT",
        conflictContactoName: name,
      };
    }
  }

  try {
    // AuditLog BEFORE mutation (REGLA CISO)
    const before = await prisma.contacto.findUnique({
      where: { id: data.contactoId },
      select: {
        nombre: true, apellido1: true, apellido2: true,
        razon_social: true, tipo_sociedad: true,
        fiscal_id: true, fiscal_id_tipo: true, notas: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        table_name: "contactos",
        record_id: data.contactoId,
        old_data: before as unknown as Prisma.InputJsonValue,
        new_data: {
          section: "identity",
          nombre: data.nombre, apellido1: data.apellido1, apellido2: data.apellido2,
          razon_social: data.razon_social, tipo_sociedad: data.tipo_sociedad,
          fiscal_id, fiscal_id_tipo: data.fiscal_id_tipo, notas: data.notas,
        },
      },
    });

    // Mutation
    await prisma.contacto.update({
      where: { id: data.contactoId },
      data: {
        nombre:         data.nombre?.trim()        || null,
        apellido1:      data.apellido1?.trim()     || null,
        apellido2:      data.apellido2?.trim()     || null,
        razon_social:   data.razon_social?.trim()  || null,
        tipo_sociedad:  data.tipo_sociedad?.trim() || null,
        fiscal_id,
        fiscal_id_tipo: data.fiscal_id_tipo,
        notas:          data.notas?.trim()         || null,
        // Auto-set es_facturadora if NIF matches BRAINLEX_MATRIZ_CIFS
        ...(isMatrizCif(fiscal_id) && { es_facturadora: true }),
      },
    });

    revalidatePath(`/contactos/${data.contactoId}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateIdentity]", err);
    return { ok: false, error: "Error al actualizar los datos de identidad." };
  }
}

// ─── Zod schema: Direct Channels ──────────────────────────────────────────────

const DirectChannelsSchema = z.object({
  contactoId: z.string().min(1),
  companyId:  z.string().min(1),
  email_principal: z
    .union([
      z.string().trim().email({ error: "Email inválido." }),
      z.literal(""),
      z.null(),
    ])
    .nullish(),
  telefono_movil: z
    .string().trim()
    .refine(
      (val) => {
        if (!val) return true;
        try { return parsePhoneNumberFromString(val)?.isValid() ?? false; }
        catch { return false; }
      },
      "Debe incluir prefijo internacional (ej. +34) y ser válido."
    )
    .nullish(),
  telefono_fijo: z
    .string().trim()
    .refine(
      (val) => {
        if (!val) return true;
        try { return parsePhoneNumberFromString(val)?.isValid() ?? false; }
        catch { return false; }
      },
      "Debe incluir prefijo internacional (ej. +34) y ser válido."
    )
    .nullish(),
  website_url: z
    .union([
      z.string().trim().url({ error: "URL inválida." }),
      z.literal(""),
      z.null(),
    ])
    .nullish(),
  linkedin_url: z
    .union([
      z.string().trim().url({ error: "URL de LinkedIn inválida." }),
      z.literal(""),
      z.null(),
    ])
    .nullish(),
  canal_preferido: z.enum(["EMAIL", "MOVIL"]).default("EMAIL"),
});

// ─── updateDirectChannels ─────────────────────────────────────────────────────

export async function updateDirectChannels(
  _prevState: ChannelsActionResult | null,
  formData: FormData,
): Promise<ChannelsActionResult> {
  const str = (key: string) => (formData.get(key) as string | null) ?? undefined;
  const raw = {
    contactoId:      formData.get("contactoId")      as string,
    companyId:       formData.get("companyId")        as string,
    email_principal: str("email_principal"),
    telefono_movil:  str("telefono_movil"),
    telefono_fijo:   str("telefono_fijo"),
    website_url:     str("website_url"),
    linkedin_url:    str("linkedin_url"),
    canal_preferido: str("canal_preferido"),
  };

  const parsed = DirectChannelsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<string, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key]!.push(issue.message);
    }
    return { ok: false, error: "Hay campos con errores de validación.", fieldErrors };
  }

  const data = parsed.data;

  // Scope guard
  const access = await assertTenantAccess(data.contactoId, data.companyId);
  if (!access.allowed) return { ok: false, error: access.error };

  try {
    // AuditLog BEFORE mutation
    const before = await prisma.contacto.findUnique({
      where: { id: data.contactoId },
      select: {
        email_principal: true, telefono_movil: true, telefono_fijo: true,
        website_url: true, linkedin_url: true, canal_preferido: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        table_name: "contactos",
        record_id: data.contactoId,
        old_data: before as unknown as Prisma.InputJsonValue,
        new_data: {
          section: "directChannels",
          email_principal: data.email_principal || null,
          telefono_movil:  data.telefono_movil  || null,
          telefono_fijo:   data.telefono_fijo   || null,
          website_url:     data.website_url?.toLowerCase() || null,
          linkedin_url:    data.linkedin_url?.toLowerCase() || null,
          canal_preferido: data.canal_preferido,
        },
      },
    });

    const movil = data.telefono_movil?.trim() || null;
    const fijo  = data.telefono_fijo?.trim()  || null;

    // Update contacto fields
    await prisma.contacto.update({
      where: { id: data.contactoId },
      data: {
        email_principal: data.email_principal?.trim() || null,
        telefono_movil:  movil,
        telefono_fijo:   fijo,
        website_url:     data.website_url?.trim().toLowerCase()  || null,
        linkedin_url:    data.linkedin_url?.trim().toLowerCase() || null,
        canal_preferido: data.canal_preferido ?? "EMAIL",
      },
    });

    // Sync CanalComunicacion favorito MOVIL if telefono_movil changed
    if (before && movil && movil !== before.telefono_movil) {
      // Upsert: find existing favorito MOVIL canal and update, or create
      const existingMovilCanal = await prisma.canalComunicacion.findFirst({
        where: {
          contactoId: data.contactoId,
          tipo: "TELEFONO",
          subtipo: "MOVIL",
          es_favorito: true,
        },
      });
      if (existingMovilCanal) {
        await prisma.canalComunicacion.update({
          where: { id: existingMovilCanal.id },
          data: { valor: movil },
        });
      } else {
        await prisma.canalComunicacion.create({
          data: {
            contactoId: data.contactoId,
            tipo: "TELEFONO",
            subtipo: "MOVIL",
            valor: movil,
            etiqueta: "Móvil",
            es_principal: true,
            es_favorito: true,
          },
        });
      }
    }

    // Same for fijo
    if (before && fijo && fijo !== before.telefono_fijo) {
      const existingFijoCanal = await prisma.canalComunicacion.findFirst({
        where: {
          contactoId: data.contactoId,
          tipo: "TELEFONO",
          subtipo: "FIJO",
          es_favorito: true,
        },
      });
      if (existingFijoCanal) {
        await prisma.canalComunicacion.update({
          where: { id: existingFijoCanal.id },
          data: { valor: fijo },
        });
      }
      // Don't auto-create fijo canal — only sync if exists
    }

    revalidatePath(`/contactos/${data.contactoId}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateDirectChannels]", err);
    return { ok: false, error: "Error al actualizar los canales de comunicación." };
  }
}
