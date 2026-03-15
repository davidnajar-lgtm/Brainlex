// ============================================================================
// lib/services/blueprintMaterialize.service.ts — Plan de Materialización de Blueprints
//
// @role: @Doc-Specialist
// @spec: Genera el plan de Carpeta records a crear cuando se asigna un
//        Constructor (Departamento/Servicio) a un contacto.
//
// FUNCIÓN PURA: no toca BD. Devuelve un plan que el server action ejecuta.
//
// Jerarquía:
//   Departamento → 1 carpeta INTELIGENTE (sin subcarpetas)
//   Servicio     → 1 carpeta INTELIGENTE + N subcarpetas es_blueprint=true
// ============================================================================

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Subcarpetas por defecto cuando la etiqueta no tiene blueprint definido. */
export const SUBCARPETAS_DEFAULT = [
  "Documentación",
  "Facturación",
  "Presupuestos",
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PlanInput {
  etiquetaId:                  string;
  etiquetaNombre:              string;
  categoriaNombre:             string;
  blueprint:                   string[] | null;
  parentEtiquetaId:            string | null;
  /** IDs de etiquetas que ya tienen Carpeta creada para este contacto. */
  existingCarpetaEtiquetaIds:  Set<string>;
  /** Mapa etiqueta_id → carpeta_id para resolver parentCarpetaId. */
  existingCarpetasByEtiqueta:  Map<string, string>;
  /** Naturaleza del servicio: "PUNTUAL" | "ANUAL". Default: "PUNTUAL". */
  periodicidad?:               string;
}

export interface BlueprintCarpetaPlan {
  skip: boolean;
  rootCarpeta: {
    nombre:          string;
    etiqueta_id:     string;
    es_blueprint:    boolean;
    parentCarpetaId: string | null;
  } | null;
  /** Nombre de carpeta de año (ej. "2026") — solo para periodicidad ANUAL. */
  yearFolder: string | null;
  /** Nombres de subcarpetas blueprint (se crean como children de rootCarpeta o yearFolder). */
  subcarpetas: string[];
}

// ─── Plan builder (función pura) ─────────────────────────────────────────────

export function planBlueprintCarpetas(input: PlanInput): BlueprintCarpetaPlan {
  const {
    etiquetaId,
    etiquetaNombre,
    categoriaNombre,
    blueprint,
    parentEtiquetaId,
    existingCarpetaEtiquetaIds,
    existingCarpetasByEtiqueta,
    periodicidad,
  } = input;

  const SKIP: BlueprintCarpetaPlan = { skip: true, rootCarpeta: null, yearFolder: null, subcarpetas: [] };

  // Solo Constructor (Departamento/Servicio)
  if (categoriaNombre !== "Departamento" && categoriaNombre !== "Servicio") {
    return SKIP;
  }

  // Idempotencia: no duplicar si ya existe carpeta para esta etiqueta
  if (existingCarpetaEtiquetaIds.has(etiquetaId)) {
    return SKIP;
  }

  // Resolver parent_id de la carpeta (solo si el Servicio tiene Departamento padre con carpeta)
  const parentCarpetaId = parentEtiquetaId
    ? existingCarpetasByEtiqueta.get(parentEtiquetaId) ?? null
    : null;

  const rootCarpeta = {
    nombre: etiquetaNombre,
    etiqueta_id: etiquetaId,
    es_blueprint: false,
    parentCarpetaId,
  };

  // Departamento: solo la carpeta raíz, sin subcarpetas, sin yearFolder
  if (categoriaNombre === "Departamento") {
    return { skip: false, rootCarpeta, yearFolder: null, subcarpetas: [] };
  }

  // Servicio: carpeta + subcarpetas blueprint
  const subcarpetas = resolveSubcarpetas(blueprint);

  // ANUAL: insertar carpeta de año actual entre servicio y subcarpetas
  const yearFolder = periodicidad === "ANUAL"
    ? new Date().getFullYear().toString()
    : null;

  return { skip: false, rootCarpeta, yearFolder, subcarpetas };
}

// ─── Tenant resolution ───────────────────────────────────────────────────────

/** Mapea EtiquetaScope → company_id del tenant. GLOBAL → null. */
export function scopeToCompanyId(scope: string | null | undefined): string | null {
  if (scope === "LEXCONOMY") return "LX";
  if (scope === "LAWTECH")   return "LW";
  return null; // GLOBAL o desconocido → sin tenant fijo
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveSubcarpetas(blueprint: string[] | null): string[] {
  const folders =
    Array.isArray(blueprint) && blueprint.length > 0
      ? blueprint
      : SUBCARPETAS_DEFAULT;
  return [...folders].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true })
  );
}
