// ============================================================================
// agents/data/TaxonomyManager.ts — Agente de Datos: Guardián del Esquema
//
// @role:   @Data-Architect / Agente de Datos
// @spec:   Micro-Spec 2.x — Integridad Estructural de Contactos
// @author: Arquitecto Jefe (Project Manager)
//
// RESPONSABILIDAD:
//   Blindar el esquema de `Contactos` impidiendo que se añadan campos de
//   comunicación que no sigan el formato de "Campos Fijos" unificados.
//
// CAMPOS FIJOS DE COMUNICACIÓN (inamovibles en Contacto):
//   ┌────────────────────┬──────────────────────────────────────────────┐
//   │ Campo              │ Descripción                                  │
//   ├────────────────────┼──────────────────────────────────────────────┤
//   │ email_principal    │ Email único (índice UNIQUE en BD)            │
//   │ telefono_movil     │ Número E.164 de móvil                        │
//   │ telefono_fijo      │ Número E.164 de fijo/central                 │
//   │ website_url        │ URL normalizada a https://                   │
//   │ linkedin_url       │ URL del perfil de LinkedIn                   │
//   │ canal_preferido    │ Canal oficial: "EMAIL" | "MOVIL"             │
//   └────────────────────┴──────────────────────────────────────────────┘
//
//   Cualquier intento de añadir un campo fuera de esta lista DEBE ser
//   rechazado con SchemaVetoError. No se permiten campos ad-hoc.
//
// CANALES ADICIONALES (CanalComunicacion — tabla satélite):
//   Para números extra, emails secundarios, WhatsApp, etc., se usa la tabla
//   `canales_comunicacion`. Solo los tipos de la whitelist son aceptados.
//
// REGLA DE VETO DEL AGENTE DE DATOS:
//   → No se puede añadir un campo de comunicación libre a `Contacto`.
//   → Todo canal adicional va a `CanalComunicacion` con tipo WHITELISTED.
//   → No se puede crear un CanalComunicacion con tipo fuera de la whitelist.
//
// CERTIFICADO DE MÓDULO:
//   Versión: 1.0.0 | Fecha: 2026-03-07 | Aprobado: Arquitecto Jefe
// ============================================================================

// ─── Campos Fijos (whitelist canónica del modelo Contacto) ───────────────────

/**
 * Campos de comunicación directa aceptados en el modelo Contacto.
 * INMUTABLES: no ampliar sin aprobación del Arquitecto Jefe + @Data-Architect.
 */
export const CONTACTO_FIXED_COMM_FIELDS = [
  "email_principal",
  "telefono_movil",
  "telefono_fijo",
  "website_url",
  "linkedin_url",
  "canal_preferido",
] as const;

export type ContactoFixedCommField = (typeof CONTACTO_FIXED_COMM_FIELDS)[number];

// ─── Tipos de canal en CanalComunicacion (whitelist) ─────────────────────────

/**
 * Tipos de canal permitidos en la tabla `canales_comunicacion`.
 * Alineados con el campo `tipo` del modelo CanalComunicacion en schema.prisma.
 * Para añadir un tipo nuevo se requiere aprobación de @Data-Architect.
 */
export const ALLOWED_CANAL_TIPOS = [
  "TELEFONO",
  "EMAIL",
  "WEB",
  "LINKEDIN",
  "WHATSAPP",
  "FAX",
  "OTRA",
] as const;

export type CanalTipo = (typeof ALLOWED_CANAL_TIPOS)[number];

// ─── Error de veto del esquema ────────────────────────────────────────────────

export class SchemaVetoError extends Error {
  readonly code = "SCHEMA_VETO" as const;
  readonly httpStatus = 422;

  constructor(
    message: string,
    public readonly field: string,
    public readonly suggestedAlternative?: string
  ) {
    super(message);
    this.name = "SchemaVetoError";
    Object.setPrototypeOf(this, SchemaVetoError.prototype);
  }
}

// ─── TaxonomyManager ─────────────────────────────────────────────────────────

export const TaxonomyManager = {
  /**
   * Verifica que un campo de comunicación está en la whitelist de Campos Fijos.
   * Lanza SchemaVetoError si el campo no está permitido.
   *
   * USO: llamar desde cualquier Server Action que intente escribir un campo
   * de comunicación en la tabla `contactos`.
   */
  assertFixedCommField(field: string): asserts field is ContactoFixedCommField {
    if (!(CONTACTO_FIXED_COMM_FIELDS as readonly string[]).includes(field)) {
      throw new SchemaVetoError(
        `[AGENTE DE DATOS VETO] El campo "${field}" no pertenece a los Campos Fijos de Comunicación de Contacto. ` +
          `Campos permitidos: ${CONTACTO_FIXED_COMM_FIELDS.join(", ")}. ` +
          `Si necesitas un canal adicional, usa la tabla CanalComunicacion.`,
        field,
        "CanalComunicacion"
      );
    }
  },

  /**
   * Verifica que un conjunto de claves no incluye campos de comunicación
   * no autorizados. Usado para auditar payloads de actualización de Contacto.
   *
   * Devuelve la lista de campos violadores (vacía si todo es correcto).
   */
  auditCommFields(fields: Record<string, unknown>): string[] {
    const knownNonCommFields = new Set([
      "id", "tipo", "nombre", "apellido1", "apellido2",
      "razon_social", "tipo_sociedad", "fiscal_id", "fiscal_id_tipo",
      "es_cliente", "es_contacto", "notas", "metadata", "status",
      "quarantine_reason", "quarantine_expires_at", "forgotten_at",
      "created_at", "updated_at",
      ...CONTACTO_FIXED_COMM_FIELDS,
    ]);

    return Object.keys(fields).filter((key) => !knownNonCommFields.has(key));
  },

  /**
   * Valida que el tipo de un CanalComunicacion está en la whitelist permitida.
   * Lanza SchemaVetoError si el tipo no es reconocido.
   */
  assertCanalTipo(tipo: string): asserts tipo is CanalTipo {
    if (!(ALLOWED_CANAL_TIPOS as readonly string[]).includes(tipo)) {
      throw new SchemaVetoError(
        `[AGENTE DE DATOS VETO] El tipo de canal "${tipo}" no está en la whitelist de CanalComunicacion. ` +
          `Tipos permitidos: ${ALLOWED_CANAL_TIPOS.join(", ")}.`,
        "tipo",
        ALLOWED_CANAL_TIPOS.join(" | ")
      );
    }
  },

  /**
   * Lista los Campos Fijos autorizados para comunicación en Contacto.
   * Útil para que el Frontend genere formularios dinámicamente.
   */
  getFixedCommFields(): readonly ContactoFixedCommField[] {
    return CONTACTO_FIXED_COMM_FIELDS;
  },

  /**
   * Lista los tipos de canal autorizados para CanalComunicacion.
   */
  getAllowedCanalTipos(): readonly CanalTipo[] {
    return ALLOWED_CANAL_TIPOS;
  },
} as const;
