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
import { ContactoTipo, FiscalIdTipo } from "@prisma/client";
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
  KLM: /^[KLM][A-Z0-9]{7}[A-Z]$/i,
  GENERIC: /^[A-Z0-9\-\s]{3,30}$/i,
} as const;

const MSG = {
  DNI: "DNI inválido: 8 dígitos + 1 letra (ej. 12345678Z).",
  NIE: "NIE inválido: [X|Y|Z] + 7 dígitos + 1 letra (ej. X1234567L).",
  CIF: "CIF inválido: letra de organización + 7 dígitos + control (ej. B12345678).",
  NIF: "NIF inválido: acepta formato DNI (12345678Z), NIE (X1234567L) o NIF de entidad (B12345678).",
  VAT: "VAT inválido: código ISO del país (2 letras) + 2-12 alfanuméricos (ej. ESB12345678, FR40303265045, DE123456789).",
  TIE: "TIE inválido: letra + 7 dígitos + carácter alfanumérico (ej. A1234567B).",
  PASAPORTE: "Pasaporte inválido: 6-20 caracteres alfanuméricos.",
  KLM: "Formato inválido: letra inicial (K/L/M) + 7 caracteres alfanuméricos + 1 letra de control.",
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
  FiscalIdTipo.K,
  FiscalIdTipo.L,
  FiscalIdTipo.M,
  FiscalIdTipo.CODIGO_SOPORTE,
  FiscalIdTipo.SIN_REGISTRO,
]);

const PJ_FISCAL_ID_TIPOS = new Set<FiscalIdTipo>([
  FiscalIdTipo.NIF,
  FiscalIdTipo.CIF,
  FiscalIdTipo.VAT,
  FiscalIdTipo.SIN_REGISTRO,
]);

// ─── Algoritmos de verificación (RD 255/2025 + Orden EHA/451/2008) ───────────
//
// DNI/NIF (personas físicas españolas):
//   número % 23 → letra de "TRWAGMYFPDXBNJZSQVHLCKE"  (RD 255/2025, art. 12)
//
// NIE (X/Y/Z + 7 dígitos + letra):
//   X→0, Y→1, Z→2, luego mismo MOD23  (Orden INT/2058/2008)
//
// NIF empresa (letra + 7 dígitos + control):
//   MOD10 sobre los 7 dígitos internos → dígito 0-9 o letra "JABCDEFGHI"
//   (Orden EHA/451/2008, art. 2)
//
// K/L/M: validación estructural únicamente.
//   Algoritmo de control no publicado oficialmente para estos tipos.

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

function checkDni(id: string): boolean {
  const n = parseInt(id.slice(0, 8), 10);
  if (isNaN(n)) return false;
  return id[8] === DNI_LETTERS[n % 23];
}

function checkNie(id: string): boolean {
  const map: Record<string, string> = { X: "0", Y: "1", Z: "2" };
  const prefix = map[id[0]];
  if (!prefix) return false;
  return checkDni(prefix + id.slice(1));
}

// Tipos que exigen letra de control (no dígito)
const CIF_MUST_LETTER = new Set(["P", "Q", "R", "S", "W"]);
// Tipos que exigen dígito de control (no letra)
const CIF_MUST_DIGIT  = new Set(["A", "B", "E", "H"]);
const CIF_LETTERS = "JABCDEFGHI";

function checkCif(id: string): boolean {
  const orgType = id[0];
  const digits  = id.slice(1, 8);
  const last    = id[8];

  let sumOdd = 0, sumEven = 0;
  for (let i = 0; i < 7; i++) {
    const d = parseInt(digits[i]);
    if ((i + 1) % 2 !== 0) {       // posiciones impares (1, 3, 5, 7)
      const v = d * 2;
      sumOdd += v > 9 ? v - 9 : v;
    } else {                        // posiciones pares (2, 4, 6)
      sumEven += d;
    }
  }
  const total   = (sumOdd + sumEven) % 10;
  const control = total === 0 ? 0 : 10 - total;
  const expLetter = CIF_LETTERS[control];
  const expDigit  = String(control);

  if (CIF_MUST_LETTER.has(orgType)) return last === expLetter;
  if (CIF_MUST_DIGIT.has(orgType))  return last === expDigit;
  return last === expLetter || last === expDigit;
}

// ─── Validador condicional de fiscal_id ──────────────────────────────────────

function validateFiscalId(
  tipo: FiscalIdTipo,
  value: string,
): string | null {
  const id = value.trim().toUpperCase();

  switch (tipo) {
    case FiscalIdTipo.DNI:
      if (!RE.DNI.test(id)) return MSG.DNI;
      if (!checkDni(id)) return "Letra de control incorrecta. Comprueba el número de DNI.";
      return null;

    case FiscalIdTipo.NIE:
      if (!RE.NIE.test(id)) return MSG.NIE;
      if (!checkNie(id)) return "Letra de control incorrecta. Comprueba el número de NIE.";
      return null;

    case FiscalIdTipo.CIF:
      if (!RE.CIF.test(id)) return MSG.CIF;
      if (!checkCif(id)) return "Carácter de control incorrecto. Comprueba el NIF de la entidad.";
      return null;

    case FiscalIdTipo.NIF: {
      if (!RE.NIF.test(id)) return MSG.NIF;
      // Detectar sub-formato y verificar dígito de control
      if (/^[0-9]/.test(id)) {
        if (!checkDni(id)) return "Letra de control incorrecta en el NIF. Comprueba el número.";
      } else if (/^[XYZ]/.test(id)) {
        if (!checkNie(id)) return "Letra de control incorrecta en el NIF. Comprueba el número.";
      } else {
        if (!checkCif(id)) return "Carácter de control incorrecto en el NIF de entidad. Comprueba el número.";
      }
      return null;
    }

    case FiscalIdTipo.VAT:
      return RE.VAT.test(id) ? null : MSG.VAT;

    case FiscalIdTipo.TIE:
      return RE.TIE.test(id) ? null : MSG.TIE;

    case FiscalIdTipo.PASAPORTE:
      return RE.PASAPORTE.test(id) ? null : MSG.PASAPORTE;

    case FiscalIdTipo.K:
    case FiscalIdTipo.L:
    case FiscalIdTipo.M:
      // Validación estructural — algoritmo de control no publicado oficialmente
      return RE.KLM.test(id) ? null : MSG.KLM;

    case FiscalIdTipo.REGISTRO_EXTRANJERO:
    case FiscalIdTipo.CODIGO_SOPORTE:
      return RE.GENERIC.test(id) ? null : MSG.GENERIC;

    case FiscalIdTipo.SIN_REGISTRO:
      return null;
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

    // Rol de Cliente — gestionado desde sidebar (toggleEsCliente), no desde el form
    es_cliente: z.boolean().optional(),

    // Notas libres (opcional)
    notas: z.string().optional(),

    // ─── Canales de Comunicación Directos (todos opcionales) ─────────────────

    email_principal: z
      .union([
        z.string().trim().email({ error: "El email no tiene un formato válido." }),
        z.literal(""),
        z.null(),
      ])
      .nullish(),

    telefono_movil: z
      .string()
      .trim()
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
      .string()
      .trim()
      .refine(
        (val) => {
          if (!val) return true;
          try { return parsePhoneNumberFromString(val)?.isValid() ?? false; }
          catch { return false; }
        },
        "Debe incluir prefijo internacional (ej. +34) y ser válido."
      )
      .nullish(),

    // website_url — normalizada a https:// en el frontend antes del submit
    website_url: z
      .union([
        z.string().trim().url({ error: "URL inválida. Ejemplo: https://www.empresa.com" }),
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
  | { ok: false; error: string; fieldErrors?: ContactoFieldErrors; conflictType?: never }
  | {
      ok:                   false;
      error:                string;
      /** Indica que el NIF ya existe en estado QUARANTINE — mostrar UI de resurrección. */
      conflictType:         "QUARANTINE_RESURRECTION";
      quarantineContactoId: string;
      contactoName:         string;
    };
export type UpdateContactoResult =
  | { ok: false; error: string; fieldErrors?: ContactoFieldErrors };
