// ============================================================================
// lib/services/driveIntegration.service.ts — Bridge BD ↔ Google Drive
//
// @role: @Integration-Broker
// @spec: FASE 11.04 — Puente entre las operaciones de Bóveda y Drive real
//
// MODO DUAL:
//   · Si isDriveConfigured() → operaciones reales en Google Drive
//   · Si no → Simulation Mode (log en consola, sin error)
//
// Este servicio es el ÚNICO punto de contacto entre boveda.actions y el
// cliente de Drive. Ninguna otra parte del código debe llamar a driveClient
// directamente para operaciones de negocio.
// ============================================================================

import {
  isDriveConfigured,
  ensureDriveFolder,
  ensureDriveFolderPath,
  getRootFolderId,
  type DriveFolder,
} from "./driveClient";

// ─── Estado del modo ────────────────────────────────────────────────────────

let _loggedSimulationMode = false;

function logSimulationMode(): void {
  if (!_loggedSimulationMode) {
    console.warn(
      "[Integration-Broker] Drive credentials missing: Running in Simulation Mode. " +
      "Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID to activate."
    );
    _loggedSimulationMode = true;
  }
}

// ─── API pública ────────────────────────────────────────────────────────────

export interface DriveSyncResult {
  mode:      "real" | "simulation";
  folderId?: string;
  path:      string;
}

/**
 * Asegura que existe la ruta completa de carpetas en Drive para un contacto.
 *
 * Estructura:
 *   ROOT_FOLDER / Contactos / {contactoName} / {departamento} / {servicio}
 *
 * @param contactoName — Nombre del contacto (se sanitiza automáticamente)
 * @param segments     — Segmentos adicionales (departamento, año, servicio, etc.)
 * @returns            — Resultado con modo + ID de la carpeta hoja
 */
export async function syncFolderToGoogleDrive(
  contactoName: string,
  segments: string[],
): Promise<DriveSyncResult> {
  const fullPath = ["Contactos", contactoName, ...segments];
  const pathStr = fullPath.join(" / ");

  if (!isDriveConfigured()) {
    logSimulationMode();
    console.log(`[Integration-Broker] SIMULATION: ensurePath(${pathStr})`);
    return { mode: "simulation", path: pathStr };
  }

  try {
    const rootId = getRootFolderId();
    const folders = await ensureDriveFolderPath(fullPath, rootId);
    const leaf = folders[folders.length - 1];

    console.log(`[Integration-Broker] REAL: ensurePath(${pathStr}) → ${leaf.id}`);
    return { mode: "real", folderId: leaf.id, path: pathStr };
  } catch (err) {
    console.error(`[Integration-Broker] Error syncing ${pathStr}:`, err);
    // No lanzamos — la BD ya creó la carpeta, Drive es best-effort
    return { mode: "simulation", path: pathStr };
  }
}

/**
 * Crea una carpeta individual en Drive dentro de un parent conocido.
 *
 * @param name           — Nombre de la carpeta
 * @param parentDriveId  — ID de Drive del parent (null → ROOT_FOLDER)
 */
export async function syncSingleFolderToGoogleDrive(
  name: string,
  parentDriveId?: string | null,
): Promise<DriveSyncResult> {
  if (!isDriveConfigured()) {
    logSimulationMode();
    console.log(`[Integration-Broker] SIMULATION: createFolder(${name})`);
    return { mode: "simulation", path: name };
  }

  try {
    const parentId = parentDriveId ?? getRootFolderId();
    const folder = await ensureDriveFolder(name, parentId);

    console.log(`[Integration-Broker] REAL: createFolder(${name}) → ${folder.id}`);
    return { mode: "real", folderId: folder.id, path: name };
  } catch (err) {
    console.error(`[Integration-Broker] Error creating folder ${name}:`, err);
    return { mode: "simulation", path: name };
  }
}

/**
 * Verifica si el modo Drive está activo.
 * Útil para mostrar indicadores en la UI.
 */
export function isDriveModeActive(): boolean {
  return isDriveConfigured();
}
