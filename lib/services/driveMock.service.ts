// ============================================================================
// lib/services/driveMock.service.ts — Mock de @File-Mirror (Google Drive)
//
// Simula la creación de carpetas en Drive para etiquetas "Constructor".
// En Fase 4+ será reemplazado por la integración real con Google Drive API.
//
// BLUEPRINT-AWARE: Si la etiqueta tiene un blueprint (JSON array de strings),
// usa esas subcarpetas. Si no, usa las subcarpetas por defecto de la categoría.
//
// JERARQUÍA DINÁMICA:
//   Contacto > Departamento > 📅 Año > Servicio > subcarpetas (blueprint)
//   Si no hay año asignado, la estructura omite el nivel temporal.
//
// @role: @Doc-Specialist (stub)
// ============================================================================

export interface DriveFolderResult {
  success:    boolean;
  folderName: string;
  path:       string;
  simulated:  true;
}

// ─── Tipos para estructura de carpetas ─────────────────────────────────────

export interface DriveFolderNode {
  name:     string;
  type:     "folder" | "placeholder" | "year";
  children: DriveFolderNode[];
}

// ─── Subcarpetas por defecto (fallback cuando no hay blueprint) ─────────────

const SUBCARPETAS_SERVICIO_DEFAULT = [
  "Documentación",
  "Presupuestos",
  "Facturación",
];

/**
 * Resuelve las subcarpetas para una etiqueta de Servicio.
 * Prioridad: blueprint de la etiqueta > fallback por defecto.
 */
function resolveSubcarpetas(
  blueprint: string[] | null | undefined
): string[] {
  if (Array.isArray(blueprint) && blueprint.length > 0) {
    return blueprint;
  }
  return SUBCARPETAS_SERVICIO_DEFAULT;
}

/**
 * Detecta si un nombre de etiqueta es un año (4 dígitos, rango razonable).
 */
export function isYearTag(nombre: string): boolean {
  return /^\d{4}$/.test(nombre.trim()) && Number(nombre) >= 2000 && Number(nombre) <= 2099;
}

/**
 * Genera un árbol de carpetas simulado con JERARQUÍA DINÁMICA:
 *
 *   Google Drive/
 *     └─ BRAINLEX/
 *         └─ Contactos/
 *             └─ {contactoName}/
 *                 └─ {Departamento}/
 *                     └─ 📅 {Año}/            ← agrupador temporal (si existe)
 *                         └─ {Servicio}/
 *                             ├─ {subcarpeta blueprint...}
 *                             └─ ...
 *
 * Si no hay etiqueta de año asignada, el nivel temporal se omite:
 *   {Departamento} > {Servicio} > subcarpetas
 *
 * Si no hay departamento, los servicios van directamente bajo el contacto:
 *   {contactoName} > [📅 Año >] {Servicio} > subcarpetas
 */
export function buildDriveFolderTree(
  contactoName: string,
  assignedConstructors: {
    categoriaNombre: string;
    etiquetaNombre:  string;
    blueprint?:      string[] | null;
  }[],
  yearTags: string[] = []
): DriveFolderNode {
  const contactoNode: DriveFolderNode = {
    name: contactoName,
    type: "folder",
    children: [],
  };

  // Separar por categoría
  const departamentos = assignedConstructors.filter((a) => a.categoriaNombre === "Departamento");
  const servicios     = assignedConstructors.filter((a) => a.categoriaNombre === "Servicio");

  // Construir nodos de servicio con sus subcarpetas (blueprint-aware)
  function buildServicioNodes(): DriveFolderNode[] {
    return servicios.map((svc) => ({
      name: svc.etiquetaNombre,
      type: "folder" as const,
      children: resolveSubcarpetas(svc.blueprint).map((sub) => ({
        name: sub,
        type: "placeholder" as const,
        children: [],
      })),
    }));
  }

  // Construir nodos de año con servicios anidados
  function buildYearNodes(): DriveFolderNode[] {
    if (yearTags.length === 0) return buildServicioNodes();

    return yearTags
      .sort((a, b) => Number(b) - Number(a)) // Más reciente primero
      .map((year) => ({
        name: year,
        type: "year" as const,
        children: buildServicioNodes(),
      }));
  }

  if (departamentos.length > 0) {
    // Departamento > [Año >] Servicio > subcarpetas
    for (const dept of departamentos) {
      const deptChildren = servicios.length > 0 || yearTags.length > 0
        ? buildYearNodes()
        : []; // Departamento vacío si no hay servicios

      contactoNode.children.push({
        name: dept.etiquetaNombre,
        type: "folder",
        children: deptChildren,
      });
    }
  } else if (servicios.length > 0 || yearTags.length > 0) {
    // Sin departamento: [Año >] Servicio > subcarpetas
    contactoNode.children.push(...buildYearNodes());
  }

  return {
    name: "Google Drive",
    type: "folder",
    children: [{
      name: "BRAINLEX",
      type: "folder",
      children: [{
        name: "Contactos",
        type: "folder",
        children: contactoNode.children.length > 0
          ? [contactoNode]
          : [],
      }],
    }],
  };
}

/**
 * Simula la creación de una carpeta en Google Drive.
 * Añade un delay artificial de 300ms para feedback visual realista.
 */
export async function createDriveFolder(params: {
  contactoId:   string;
  contactoName: string;
  categoriaNombre: string;
  etiquetaNombre:  string;
}): Promise<DriveFolderResult> {
  await new Promise((r) => setTimeout(r, 300));

  const path = `Google Drive/BRAINLEX/Contactos/${params.contactoName}/${params.etiquetaNombre}`;

  return {
    success:    true,
    folderName: params.etiquetaNombre,
    path,
    simulated:  true,
  };
}
