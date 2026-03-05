// ============================================================================
// lib/errors/business.errors.ts — Errores de Dominio (Agente Legal)
//
// Errores tipados que representan violaciones de reglas de negocio.
// La capa de servicio los lanza; la capa de controlador los mapea a HTTP.
// ============================================================================

/**
 * Lanzado cuando el Agente Legal bloquea una operación por dependencias legales.
 * El borrado físico de un Contacto con historial comercial NUNCA está permitido.
 * → HTTP 403 Forbidden
 */
export class LegalBlockError extends Error {
  readonly code = "LEGAL_BLOCK" as const;
  readonly httpStatus = 403;

  constructor(
    message: string,
    public readonly contactoId: string,
    public readonly dependencies: { expedientes: number }
  ) {
    super(message);
    this.name = "LegalBlockError";
    Object.setPrototypeOf(this, LegalBlockError.prototype);
  }
}

/**
 * Lanzado cuando un campo obligatorio de negocio está ausente o vacío.
 * → HTTP 422 Unprocessable Entity
 */
export class BusinessValidationError extends Error {
  readonly code = "BUSINESS_VALIDATION" as const;
  readonly httpStatus = 422;

  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = "BusinessValidationError";
    Object.setPrototypeOf(this, BusinessValidationError.prototype);
  }
}

/**
 * Lanzado cuando una entidad referenciada no existe en la BD.
 * → HTTP 404 Not Found
 */
export class EntityNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  readonly httpStatus = 404;

  constructor(
    public readonly entity: string,
    public readonly id: string
  ) {
    super(`${entity} no encontrado: ${id}`);
    this.name = "EntityNotFoundError";
    Object.setPrototypeOf(this, EntityNotFoundError.prototype);
  }
}
