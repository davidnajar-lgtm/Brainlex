// ============================================================================
// lib/validations/contacto.schema.ts — Validación Zod: Contacto
//
// @role: Agente de Datos (validación estructural) + Agente Legal (fiscal IDs)
// @spec: Micro-Spec 2.5 — Blindaje de Datos con Zod e Internacionalización
//
// DISEÑO:
//   - Validación condicional de fiscal_id según fiscal_id_tipo via superRefine.
//   - Identificadores españoles: DNI, NIE, CIF, NIF — validación estructural estricta.
//   - VAT europeo: prefijo ISO 3166-1 alpha-2 + cuerpo alfanumérico (VIES async: futuro).
//   - SIN_REGISTRO: sin validación de formato (cliente sin identificador oficial).
// ============================================================================

import { z } from "zod";
import { ContactoTipo, FiscalIdTipo, TipoTelefono } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// ─── Patrones estructurales ───────────────────────────────────────────────────
//
// DNI  → 8 dígitos + 1 letra de control (tabla MOD23)
//         El algoritmo de letra NO se valida aquí (validación estructural,
//         no algoritmica — reservado para Micro-Spec 2.6 Compliance).
//
// NIE  → [X|Y|Z] + 7 dígitos + 1 letra de control
//
// CIF  → 1 letra tipo org (A-W, excluyendo I,Ñ,O,U) + 7 dígitos + 1 control
//         El control puede ser letra (A-J) o dígito según tipo de sociedad.
//
// NIF  → Umbrella español: acepta formato DNI, NIE o CIF.
//
// VAT  → Código ISO 3166-1 alpha-2 (2 letras) + 2-12 alfanumérico.
//         ⚠️  Validación estructural únicamente.
//         Validación real contra API VIES: pendiente Micro-Spec 2.6 Compliance.
//
// TIE  → Tarjeta de Identidad de Extranjero: letra + 7 dígitos + alfanumérico.
//
// PASAPORTE → 6-20 caracteres alfanuméricos (formato varía por país).

const RE = {
  DNI: /^[0-9]{8}[A-Z]$/i,
  NIE: /^[XYZ][0-9]{7}[A-Z]$/i,
  CIF: /^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/i,
  NIF: /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J])$/i,
  VAT: /^[A-Z]{2}[A-Z0-9]{2,12}$/i,
  TIE: /^[A-Z][0-9]{7}[A-Z0-9]$/i,
  PASAPORTE: /^[A-Z0-9]{6,20}$/i,
  GENERIC: /^[A-Z0-9\-\s]{3,30}$/i,
} as const;

const MSG = {
  DNI: "DNI inválido: 8 dígitos + 1 letra (ej. 12345678Z).",
  NIE: "NIE inválido: [X|Y|Z] + 7 dígitos + 1 letra (ej. X1234567L).",
  CIF: "CIF inválido: letra de organización + 7 dígitos + control (ej. B12345678).",
  NIF: "NIF inválido: acepta formato DNI (12345678Z), NIE (X1234567L) o CIF (B12345678).",
  VAT: "VAT inválido: código ISO del país (2 letras) + 2-12 alfanuméricos (ej. ESB12345678, FR40303265045, DE123456789).",
  TIE: "TIE inválido: letra + 7 dígitos + carácter alfanumérico (ej. A1234567B).",
  PASAPORTE: "Pasaporte inválido: 6-20 caracteres alfanuméricos.",
  GENERIC: "Identificador inválido: 3-30 caracteres alfanuméricos.",
} as const;

// ─── Whitelists de fiscal_id_tipo por tipo de contacto ───────────────────────

const PF_FISCAL_ID_TIPOS = new Set<FiscalIdTipo>([
  FiscalIdTipo.NIF,
  FiscalIdTipo.DNI,
  FiscalIdTipo.NIE,
  FiscalIdTipo.PASAPORTE,
  FiscalIdTipo.TIE,
  FiscalIdTipo.VAT,
  FiscalIdTipo.CODIGO_SOPORTE,
  FiscalIdTipo.SIN_REGISTRO,
]);

const PJ_FISCAL_ID_TIPOS = new Set<FiscalIdTipo>([
  FiscalIdTipo.NIF,
  FiscalIdTipo.CIF,
  FiscalIdTipo.VAT,
  FiscalIdTipo.SIN_REGISTRO,
]);

// ─── Validador condicional de fiscal_id ──────────────────────────────────────

function validateFiscalId(
  tipo: FiscalIdTipo,
  value: string,
): string | null {
  const id = value.trim().toUpperCase();

  switch (tipo) {
    case FiscalIdTipo.DNI:
      return RE.DNI.test(id) ? null : MSG.DNI;
    case FiscalIdTipo.NIE:
      return RE.NIE.test(id) ? null : MSG.NIE;
    case FiscalIdTipo.CIF:
      return RE.CIF.test(id) ? null : MSG.CIF;
    case FiscalIdTipo.NIF:
      return RE.NIF.test(id) ? null : MSG.NIF;
    case FiscalIdTipo.VAT:
      return RE.VAT.test(id) ? null : MSG.VAT;
    case FiscalIdTipo.TIE:
      return RE.TIE.test(id) ? null : MSG.TIE;
    case FiscalIdTipo.PASAPORTE:
      return RE.PASAPORTE.test(id) ? null : MSG.PASAPORTE;
    case FiscalIdTipo.REGISTRO_EXTRANJERO:
    case FiscalIdTipo.CODIGO_SOPORTE:
      return RE.GENERIC.test(id) ? null : MSG.GENERIC;
    case FiscalIdTipo.SIN_REGISTRO:
      return null; // Sin validación de formato
  }
}

// ─── Schema principal ─────────────────────────────────────────────────────────

export const ContactoFormSchema = z
  .object({
    tipo: z.enum(ContactoTipo),

    // Persona Física — nullish() acepta string | null | undefined
    // null llega cuando el input no está en el DOM (tipo PJ seleccionado)
    nombre:    z.string().trim().max(100).transform((s) => s.toUpperCase()).nullish(),
    apellido1: z.string().trim().max(100).transform((s) => s.toUpperCase()).nullish(),
    apellido2: z.string().trim().max(100).transform((s) => s.toUpperCase()).nullish(),

    // Persona Jurídica — MAYÚSCULAS ABSOLUTAS para razones sociales (mandato CTO)
    razon_social:  z.string().trim().max(200).transform((s) => s.toUpperCase()).nullish(),
    tipo_sociedad: z.string().trim().max(50).optional(),

    // Identificación fiscal (validación condicional en superRefine)
    // min(1) NO se aplica aquí — el required check es condicional en superRefine
    // (SIN_REGISTRO no requiere valor en fiscal_id)
    fiscal_id_tipo: z.enum(FiscalIdTipo),
    fiscal_id: z.string().trim(),

    // Rol de Cliente (habilita facturación)
    es_cliente: z.boolean().default(false),

    // Notas libres (opcional)
    notas: z.string().optional(),

    // Contacto (opcionales)
    tipo_telefono: z.enum(TipoTelefono).default(TipoTelefono.MOVIL),

    email: z
      .union([
        z.string().trim().email({ error: "El email no tiene un formato válido." }),
        z.literal(""),
        z.null(),
      ])
      .nullish(),
    telefono: z
      .string()
      .trim()
      .refine(
        (val) => {
          if (!val) return true; // campo opcional — vacío es válido
          try {
            return parsePhoneNumberFromString(val)?.isValid() ?? false;
          } catch {
            return false;
          }
        },
        "Debe incluir prefijo internacional (ej. +34) y ser válido."
      )
      .nullish(),
  })
  .superRefine((data, ctx) => {
    // ── Nombre / Razón Social obligatorio según tipo ──────────────────────────
    if (data.tipo === ContactoTipo.PERSONA_FISICA && !data.nombre) {
      ctx.addIssue({
        code: "custom",
        message: "El nombre es obligatorio para Persona Física.",
        path: ["nombre"],
      });
    }

    if (data.tipo === ContactoTipo.PERSONA_JURIDICA && !data.razon_social) {
      ctx.addIssue({
        code: "custom",
        message: "La razón social es obligatoria para Persona Jurídica.",
        path: ["razon_social"],
      });
    }

    if (data.tipo === ContactoTipo.PERSONA_JURIDICA && !data.tipo_sociedad?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Debe indicar el tipo de sociedad (S.L., S.A., etc.).",
        path: ["tipo_sociedad"],
      });
    }

    // ── Whitelist de fiscal_id_tipo por tipo de contacto ─────────────────────
    if (
      data.tipo === ContactoTipo.PERSONA_FISICA &&
      !PF_FISCAL_ID_TIPOS.has(data.fiscal_id_tipo)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Tipo de ID fiscal no válido para Persona Física. Usa: DNI, NIE, NIF, PASAPORTE, TIE, VAT o Código de Soporte.",
        path: ["fiscal_id_tipo"],
      });
    }

    if (
      data.tipo === ContactoTipo.PERSONA_JURIDICA &&
      !PJ_FISCAL_ID_TIPOS.has(data.fiscal_id_tipo)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Tipo de ID fiscal no válido para Persona Jurídica. Usa: NIF, CIF o VAT.",
        path: ["fiscal_id_tipo"],
      });
    }

    // ── fiscal_id requerido cuando hay tipo de documento real ────────────────
    if (
      data.fiscal_id_tipo !== FiscalIdTipo.SIN_REGISTRO &&
      !data.fiscal_id.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "El identificador fiscal es obligatorio.",
        path: ["fiscal_id"],
      });
      return; // No validar formato si el campo está vacío
    }

    // ── Validación estructural del fiscal_id ─────────────────────────────────
    const error = validateFiscalId(data.fiscal_id_tipo, data.fiscal_id);
    if (error) {
      ctx.addIssue({
        code: "custom",
        message: error,
        path: ["fiscal_id"],
      });
    }
  });

// ─── Tipos derivados ──────────────────────────────────────────────────────────

export type ContactoFormInput = z.infer<typeof ContactoFormSchema>;

/** Alias semánticos para alta y edición (mismos campos). */
export type CreateContactoInput = ContactoFormInput;
export type UpdateContactoInput = ContactoFormInput;

/** Mapa de errores por campo para la UI (solo los campos del formulario). */
export type ContactoFieldErrors = Partial<
  Record<keyof ContactoFormInput, string>
>;

/** Tipos resultado de las Server Actions — definidos aquí para evitar
 *  exportar tipos desde módulos "use server" (incompatible con Turbopack). */
export type CreateContactoResult =
  | { ok: false; error: string; fieldErrors?: ContactoFieldErrors };
export type UpdateContactoResult =
  | { ok: false; error: string; fieldErrors?: ContactoFieldErrors };
