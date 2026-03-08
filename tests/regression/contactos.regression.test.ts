// ============================================================================
// tests/regression/contactos.regression.test.ts
//
// @role:   @QA-Engineer / Agente de QA (The Auditor)
// @spec:   Escenarios de regresión del módulo de Contactos
//
// COBERTURA:
//   1. TaxonomyManager — blindaje de Campos Fijos (ningún campo ad-hoc)
//   2. ContactoFormSchema (Zod) — validación de fiscal_id por tipo
//   3. i18n — diccionario cubre ES · EN · FR sin claves vacías
//   4. Guardian — interfaz pública del Agente Legal (tipos y contratos)
//   5. Integridad de esquema — CanalTipo whitelist
//
// LIMITACIÓN QA:
//   Este archivo es de solo lectura para el código de negocio.
//   El Agente de QA NO modifica los módulos que testea; solo los importa.
// ============================================================================

import { describe, it, expect } from "vitest";

import {
  TaxonomyManager,
  SchemaVetoError,
  CONTACTO_FIXED_COMM_FIELDS,
  ALLOWED_CANAL_TIPOS,
} from "@/agents/data/TaxonomyManager";

import {
  ContactoFormSchema,
} from "@/lib/modules/entidades/validations/contacto.schema";

import {
  getContactosLabels,
  type AppLocale,
} from "@/lib/i18n/contactos";

// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 1 — TaxonomyManager: Blindaje de Campos Fijos
// ═══════════════════════════════════════════════════════════════════════════════

describe("TaxonomyManager — Blindaje de Campos Fijos", () => {
  it("acepta todos los Campos Fijos de comunicación sin lanzar error", () => {
    for (const field of CONTACTO_FIXED_COMM_FIELDS) {
      expect(() => TaxonomyManager.assertFixedCommField(field)).not.toThrow();
    }
  });

  it("lanza SchemaVetoError si se intenta añadir un campo ad-hoc 'telegram_url'", () => {
    expect(() => TaxonomyManager.assertFixedCommField("telegram_url"))
      .toThrow(SchemaVetoError);
  });

  it("lanza SchemaVetoError si se intenta añadir un campo ad-hoc 'tiktok_url'", () => {
    expect(() => TaxonomyManager.assertFixedCommField("tiktok_url"))
      .toThrow(SchemaVetoError);
  });

  it("lanza SchemaVetoError si se intenta añadir un campo ad-hoc 'instagram_url'", () => {
    expect(() => TaxonomyManager.assertFixedCommField("instagram_url"))
      .toThrow(SchemaVetoError);
  });

  it("lanza SchemaVetoError si se intenta añadir un campo de base de datos inventado", () => {
    expect(() => TaxonomyManager.assertFixedCommField("numero_extraño"))
      .toThrow(SchemaVetoError);
  });

  it("el error SchemaVetoError indica el campo problemático", () => {
    try {
      TaxonomyManager.assertFixedCommField("facebook_url");
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaVetoError);
      if (err instanceof SchemaVetoError) {
        expect(err.field).toBe("facebook_url");
        expect(err.suggestedAlternative).toBe("CanalComunicacion");
      }
    }
  });

  it("auditCommFields detecta campos desconocidos en un payload de actualización", () => {
    const illegalPayload = {
      nombre:         "JUAN",
      email_principal: "juan@test.com",
      telegram_handle: "@juan",   // ← campo no autorizado
    };

    const violations = TaxonomyManager.auditCommFields(illegalPayload);
    expect(violations).toContain("telegram_handle");
    expect(violations).not.toContain("nombre");
    expect(violations).not.toContain("email_principal");
  });

  it("auditCommFields devuelve array vacío para payload limpio", () => {
    const cleanPayload = {
      nombre:          "JUAN",
      email_principal: "juan@test.com",
      telefono_movil:  "+34600000000",
    };

    const violations = TaxonomyManager.auditCommFields(cleanPayload);
    expect(violations).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 2 — TaxonomyManager: Whitelist de CanalTipo
// ═══════════════════════════════════════════════════════════════════════════════

describe("TaxonomyManager — Whitelist de CanalTipo", () => {
  it("acepta todos los CanalTipos de la whitelist sin error", () => {
    for (const tipo of ALLOWED_CANAL_TIPOS) {
      expect(() => TaxonomyManager.assertCanalTipo(tipo)).not.toThrow();
    }
  });

  it("lanza SchemaVetoError para tipo 'TELEGRAM' (no en whitelist)", () => {
    expect(() => TaxonomyManager.assertCanalTipo("TELEGRAM"))
      .toThrow(SchemaVetoError);
  });

  it("lanza SchemaVetoError para tipo 'TIKTOK' (no en whitelist)", () => {
    expect(() => TaxonomyManager.assertCanalTipo("TIKTOK"))
      .toThrow(SchemaVetoError);
  });

  it("lanza SchemaVetoError para tipo en minúsculas (case-sensitive)", () => {
    expect(() => TaxonomyManager.assertCanalTipo("telefono"))
      .toThrow(SchemaVetoError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 3 — Zod Schema: Validación de fiscal_id
// ═══════════════════════════════════════════════════════════════════════════════

describe("ContactoFormSchema — Validación de Fiscal ID", () => {
  const basePersonaFisica = {
    tipo:           "PERSONA_FISICA" as const,
    nombre:         "JUAN",
    fiscal_id_tipo: "DNI" as const,
    es_cliente:     false,
  };

  it("acepta un DNI válido (8 dígitos + letra)", () => {
    const result = ContactoFormSchema.safeParse({
      ...basePersonaFisica,
      fiscal_id: "12345678Z",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un DNI con formato incorrecto (menos de 8 dígitos)", () => {
    const result = ContactoFormSchema.safeParse({
      ...basePersonaFisica,
      fiscal_id: "1234Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("fiscal_id");
    }
  });

  it("acepta un NIE válido (X + 7 dígitos + letra)", () => {
    const result = ContactoFormSchema.safeParse({
      ...basePersonaFisica,
      fiscal_id_tipo: "NIE",
      fiscal_id:      "X1234567L",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza NIE con prefijo incorrecto", () => {
    const result = ContactoFormSchema.safeParse({
      ...basePersonaFisica,
      fiscal_id_tipo: "NIE",
      fiscal_id:      "A1234567L",
    });
    expect(result.success).toBe(false);
  });

  it("acepta CIF válido para Persona Jurídica", () => {
    const result = ContactoFormSchema.safeParse({
      tipo:           "PERSONA_JURIDICA",
      razon_social:   "EMPRESA TEST S.L.",
      tipo_sociedad:  "S.L.",
      fiscal_id_tipo: "CIF",
      fiscal_id:      "B12345678",
      es_cliente:     false,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza CIF en Persona Física (tipo no permitido)", () => {
    const result = ContactoFormSchema.safeParse({
      ...basePersonaFisica,
      fiscal_id_tipo: "CIF",
      fiscal_id:      "B12345678",
    });
    expect(result.success).toBe(false);
  });

  it("acepta SIN_REGISTRO sin fiscal_id", () => {
    const result = ContactoFormSchema.safeParse({
      ...basePersonaFisica,
      fiscal_id_tipo: "SIN_REGISTRO",
      fiscal_id:      "",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza Persona Física sin nombre", () => {
    const result = ContactoFormSchema.safeParse({
      tipo:           "PERSONA_FISICA" as const,
      fiscal_id_tipo: "DNI" as const,
      fiscal_id:      "12345678Z",
      es_cliente:     false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("nombre");
    }
  });

  it("rechaza Persona Jurídica sin tipo_sociedad", () => {
    const result = ContactoFormSchema.safeParse({
      tipo:           "PERSONA_JURIDICA",
      razon_social:   "EMPRESA TEST S.L.",
      fiscal_id_tipo: "CIF",
      fiscal_id:      "B12345678",
      es_cliente:     false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("tipo_sociedad");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 4 — i18n: Cobertura ES · EN · FR
// ═══════════════════════════════════════════════════════════════════════════════

describe("i18n — Cobertura completa de locales", () => {
  const LOCALES: AppLocale[] = ["es", "en", "fr"];

  it("devuelve labels para los 3 locales sin error", () => {
    for (const locale of LOCALES) {
      expect(() => getContactosLabels(locale)).not.toThrow();
    }
  });

  it("ningún label crítico está vacío en ES", () => {
    const labels = getContactosLabels("es");
    expect(labels.fields.nombre).toBeTruthy();
    expect(labels.fields.emailPrincipal).toBeTruthy();
    expect(labels.fields.telefonoMovil).toBeTruthy();
    expect(labels.sections.identidad).toBeTruthy();
  });

  it("ningún label crítico está vacío en EN", () => {
    const labels = getContactosLabels("en");
    expect(labels.fields.nombre).toBeTruthy();
    expect(labels.fields.emailPrincipal).toBeTruthy();
    expect(labels.fields.telefonoMovil).toBeTruthy();
    expect(labels.sections.identidad).toBeTruthy();
  });

  it("ningún label crítico está vacío en FR", () => {
    const labels = getContactosLabels("fr");
    expect(labels.fields.nombre).toBeTruthy();
    expect(labels.fields.emailPrincipal).toBeTruthy();
    expect(labels.fields.telefonoMovil).toBeTruthy();
    expect(labels.sections.identidad).toBeTruthy();
  });

  it("los labels de EN difieren de ES (no es copia sin traducir)", () => {
    const es = getContactosLabels("es");
    const en = getContactosLabels("en");
    // Al menos la sección principal debe ser diferente
    expect(en.sections.identidad).not.toBe(es.sections.identidad);
    expect(en.fields.telefonoMovil).not.toBe(es.fields.telefonoMovil);
  });

  it("los labels de FR difieren de ES (no es copia sin traducir)", () => {
    const es = getContactosLabels("es");
    const fr = getContactosLabels("fr");
    expect(fr.sections.identidad).not.toBe(es.sections.identidad);
    expect(fr.fields.telefonoFijo).not.toBe(es.fields.telefonoFijo);
  });

  it("canalTipo incluye los tipos de la whitelist de TaxonomyManager", () => {
    const labels = getContactosLabels("es");
    // Los tipos principales deben estar en el diccionario
    expect(labels.canalTipo["TELEFONO"]).toBeTruthy();
    expect(labels.canalTipo["EMAIL"]).toBeTruthy();
    expect(labels.canalTipo["WHATSAPP"]).toBeTruthy();
  });

  it("fallback al diccionario ES para locale desconocido", () => {
    // @ts-expect-error: locale inválido a propósito
    const labels = getContactosLabels("de");
    // Debe devolver los labels en español (fallback)
    const esLabels = getContactosLabels("es");
    expect(labels.fields.nombre).toBe(esLabels.fields.nombre);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 5 — Integridad: Campos Fijos son exactamente 6
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integridad de Campos Fijos — Regresión de Esquema", () => {
  it("CONTACTO_FIXED_COMM_FIELDS tiene exactamente 6 campos (contrato estable)", () => {
    // Este test es un CENTINELA: si alguien añade un campo ad-hoc al modelo
    // sin pasar por el proceso de aprobación, este test fallará.
    expect(CONTACTO_FIXED_COMM_FIELDS).toHaveLength(6);
  });

  it("los 6 campos fijos son exactamente los esperados (sin sorpresas)", () => {
    const expected = new Set([
      "email_principal",
      "telefono_movil",
      "telefono_fijo",
      "website_url",
      "linkedin_url",
      "canal_preferido",
    ]);

    for (const field of CONTACTO_FIXED_COMM_FIELDS) {
      expect(expected.has(field)).toBe(true);
    }
  });

  it("ALLOWED_CANAL_TIPOS tiene exactamente 7 tipos (whitelist estable)", () => {
    // Centinela: cualquier adición no aprobada al enum de canales fallará aquí.
    expect(ALLOWED_CANAL_TIPOS).toHaveLength(7);
  });
});
