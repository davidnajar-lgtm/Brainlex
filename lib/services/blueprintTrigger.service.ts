// ============================================================================
// lib/services/blueprintTrigger.service.ts — Trigger de Blueprints en Drive
//
// @role: @Doc-Specialist
// @spec: Consolidacion Point 0 — Logica de deteccion de blueprints
//
// FASE ACTUAL: Solo logica de DETECCION y console.log.
// NO ejecuta llamadas reales a Google Drive API.
// En Fase 4+ este modulo delegara al @File-Mirror real.
//
// RESPONSABILIDAD:
//   Dado un contacto y sus etiquetas Constructor asignadas, detectar:
//   1. Si debe crearse la carpeta raiz del contacto en Drive
//   2. Si debe crearse una carpeta de año (nivel temporal)
//   3. Que subcarpetas (blueprint) desplegar para cada servicio
//   4. Devolver un plan de ejecucion sin ejecutar (dry-run)
// ============================================================================

import { isYearTag } from "@/lib/services/driveMock.service";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface BlueprintAssignment {
  etiquetaId:      string;
  etiquetaNombre:  string;
  categoriaNombre: string;
  blueprint:       string[] | null;
  parentId:        string | null;
}

export interface BlueprintTriggerPlan {
  contactoId:   string;
  contactoName: string;
  shouldCreateRoot: boolean;
  yearFolders:      string[];
  departmentFolders: Array<{
    name: string;
    etiquetaId: string;
  }>;
  serviceFolders: Array<{
    name: string;
    etiquetaId: string;
    parentDepartment: string | null;
    subcarpetas: string[];
  }>;
  totalFoldersToCreate: number;
  timestamp: string;
}

// ─── Subcarpetas por defecto ────────────────────────────────────────────────

const SUBCARPETAS_SERVICIO_DEFAULT = [
  "Documentacion",
  "Presupuestos",
  "Facturacion",
];

function resolveSubcarpetas(blueprint: string[] | null): string[] {
  return Array.isArray(blueprint) && blueprint.length > 0
    ? blueprint
    : SUBCARPETAS_SERVICIO_DEFAULT;
}

// ─── Detector principal ─────────────────────────────────────────────────────

/**
 * Analiza las etiquetas Constructor asignadas a un contacto
 * y genera un plan de despliegue de carpetas en Drive.
 *
 * Este plan es un dry-run: no ejecuta nada, solo describe que habria que hacer.
 * En Fase 4+, este plan se pasara al @File-Mirror para ejecucion real.
 */
export function detectBlueprintTrigger(
  contactoId: string,
  contactoName: string,
  assignments: BlueprintAssignment[]
): BlueprintTriggerPlan {
  const departamentos = assignments.filter((a) => a.categoriaNombre === "Departamento");
  const servicios     = assignments.filter((a) => a.categoriaNombre === "Servicio");
  const yearTags      = assignments
    .filter((a) => isYearTag(a.etiquetaNombre))
    .map((a) => a.etiquetaNombre);

  const hasConstructors = departamentos.length > 0 || servicios.length > 0;

  const serviceFolders = servicios.map((svc) => {
    const parentDept = svc.parentId
      ? departamentos.find((d) => d.etiquetaId === svc.parentId)?.etiquetaNombre ?? null
      : null;
    return {
      name: svc.etiquetaNombre,
      etiquetaId: svc.etiquetaId,
      parentDepartment: parentDept,
      subcarpetas: resolveSubcarpetas(svc.blueprint),
    };
  });

  // Count total folders: root + departments + (years * services * subcarpetas per service)
  const yearsCount = Math.max(yearTags.length, 1); // al menos 1 nivel (sin año)
  const subcarpetaCount = serviceFolders.reduce((acc, s) => acc + s.subcarpetas.length, 0);
  const totalFoldersToCreate = hasConstructors
    ? 1 // raiz contacto
      + departamentos.length
      + yearTags.length
      + servicios.length * yearsCount
      + subcarpetaCount * yearsCount
    : 0;

  const plan: BlueprintTriggerPlan = {
    contactoId,
    contactoName,
    shouldCreateRoot: hasConstructors,
    yearFolders: yearTags,
    departmentFolders: departamentos.map((d) => ({
      name: d.etiquetaNombre,
      etiquetaId: d.etiquetaId,
    })),
    serviceFolders,
    totalFoldersToCreate,
    timestamp: new Date().toISOString(),
  };

  // ── LOG de deteccion (Fase 0 — solo console) ──────────────────────────
  if (hasConstructors) {
    console.log(
      `[BlueprintTrigger] PLAN DETECTADO para "${contactoName}" (${contactoId}):\n` +
      `  Carpeta raiz: ${plan.shouldCreateRoot ? "SI" : "NO"}\n` +
      `  Departamentos: ${departamentos.map((d) => d.etiquetaNombre).join(", ") || "ninguno"}\n` +
      `  Servicios: ${servicios.map((s) => `${s.etiquetaNombre} (${resolveSubcarpetas(s.blueprint).length} subcarpetas)`).join(", ") || "ninguno"}\n` +
      `  Anos: ${yearTags.join(", ") || "sin ano asignado"}\n` +
      `  Total carpetas a crear: ${totalFoldersToCreate}`
    );
  }

  return plan;
}

/**
 * Detecta si una etiqueta recien asignada deberia disparar un blueprint.
 * Se llama cada vez que se asigna una etiqueta Constructor a un contacto.
 *
 * Retorna true si la asignacion implica cambios en Drive.
 */
export function shouldTriggerBlueprint(
  categoriaNombre: string,
  etiquetaNombre: string
): boolean {
  const isConstructor = categoriaNombre === "Departamento" || categoriaNombre === "Servicio";
  const isYear = isYearTag(etiquetaNombre);

  if (isConstructor || isYear) {
    console.log(
      `[BlueprintTrigger] TRIGGER detectado: "${etiquetaNombre}" (${categoriaNombre}) — ` +
      `${isConstructor ? "Constructor" : "Ano temporal"} → requiere actualizacion de estructura Drive`
    );
    return true;
  }

  return false;
}
