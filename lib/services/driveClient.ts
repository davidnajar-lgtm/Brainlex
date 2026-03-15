// ============================================================================
// lib/services/driveClient.ts — Cliente oficial de Google Drive API
//
// @role: @Integration-Broker
// @spec: FASE 11.04 — Motor de integración real con Google Drive
//
// Arquitectura:
//   · Service Account Auth (JSON desde env var — VETO I3)
//   · Exponential Backoff con jitter para 403/429/5xx (VETO I1)
//   · Singleton: una sola instancia del cliente por process
//   · Auto-detect: isDriveConfigured() → Simulation Mode si falta config
//
// VETO I3 — CREDENCIALES:
//   Las credenciales NUNCA se hardcodean. Se leen exclusivamente de:
//     GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON  (JSON completo del Service Account)
//     GOOGLE_DRIVE_ROOT_FOLDER_ID        (ID de la carpeta raíz en Drive)
// ============================================================================

import { google, type drive_v3 } from "googleapis";
import { GoogleAuth } from "google-auth-library";

// ─── Config ─────────────────────────────────────────────────────────────────

const MAX_RETRIES   = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS  = 32000;

// ─── Helpers puros (exportados para testing) ─────────────────────────────────

/** Detecta si las credenciales de Drive están configuradas en el entorno. */
export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim() &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()
  );
}

/** Sanitiza nombre de carpeta para Google Drive. */
export function sanitizeFolderName(name: string): string {
  return name.trim().replace(/[/\\:*?"<>|]/g, "_");
}

/** Calcula delay para exponential backoff con jitter. */
export function calculateBackoff(attempt: number, baseMs = BASE_DELAY_MS, maxMs = MAX_DELAY_MS): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = exponential * (0.5 + Math.random() * 0.5);
  return Math.round(jitter);
}

/** Determina si un error HTTP es retryable. */
export function isRetryableError(statusCode: number): boolean {
  return statusCode === 429 || statusCode === 403 || (statusCode >= 500 && statusCode < 600);
}

// ─── Singleton del cliente ──────────────────────────────────────────────────

let _driveInstance: drive_v3.Drive | null = null;

/**
 * Obtiene la instancia singleton del cliente de Google Drive.
 * Lanza error si las credenciales no están configuradas.
 */
function getDriveClient(): drive_v3.Drive {
  if (_driveInstance) return _driveInstance;

  const jsonStr = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) {
    throw new Error(
      "[DriveClient] GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON no está configurada. " +
      "Contacta con IT para obtener las credenciales del Service Account."
    );
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      "[DriveClient] GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON contiene JSON inválido."
    );
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  _driveInstance = google.drive({ version: "v3", auth });
  return _driveInstance;
}

/** ID de la carpeta raíz configurada en el entorno. */
export function getRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id?.trim()) {
    throw new Error(
      "[DriveClient] GOOGLE_DRIVE_ROOT_FOLDER_ID no está configurada."
    );
  }
  return id.trim();
}

// ─── VETO I1: executeWithRetry ──────────────────────────────────────────────

/**
 * Ejecuta una operación de Drive con Exponential Backoff.
 *
 * VETO I1: Ninguna llamada a API externa sin rate-limit handling.
 * Reintenta automáticamente en 403 (rate limit), 429 y 5xx.
 * Errores 400/401/404 fallan inmediatamente (no son transitorios).
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  label = "DriveOperation",
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Extraer status code del error de googleapis
      const statusCode = (err as { code?: number })?.code ??
                         (err as { response?: { status?: number } })?.response?.status ??
                         0;

      if (!isRetryableError(statusCode) || attempt === MAX_RETRIES) {
        throw lastError;
      }

      const delay = calculateBackoff(attempt);
      console.warn(
        `[DriveClient] ${label} failed (${statusCode}), retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError ?? new Error(`[DriveClient] ${label} failed after ${MAX_RETRIES} retries`);
}

// ─── Operaciones de Drive ───────────────────────────────────────────────────

export interface DriveFolder {
  id:   string;
  name: string;
}

/**
 * Crea una carpeta en Google Drive dentro de un parent folder.
 * Usa executeWithRetry para manejar rate limits.
 */
export async function createDriveFolder(
  name: string,
  parentFolderId: string,
): Promise<DriveFolder> {
  const sanitized = sanitizeFolderName(name);
  const drive = getDriveClient();

  const result = await executeWithRetry(async () => {
    const res = await drive.files.create({
      requestBody: {
        name: sanitized,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id, name",
    });
    return res.data;
  }, `createFolder(${sanitized})`);

  if (!result.id) {
    throw new Error(`[DriveClient] createFolder(${sanitized}): response sin ID`);
  }

  return { id: result.id, name: result.name ?? sanitized };
}

/**
 * Busca una carpeta por nombre dentro de un parent folder.
 * Retorna la primera coincidencia o null.
 */
export async function findDriveFolder(
  name: string,
  parentFolderId: string,
): Promise<DriveFolder | null> {
  const sanitized = sanitizeFolderName(name);
  const drive = getDriveClient();

  const result = await executeWithRetry(async () => {
    const res = await drive.files.list({
      q: `name = '${sanitized.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 1,
    });
    return res.data.files ?? [];
  }, `findFolder(${sanitized})`);

  if (result.length === 0) return null;
  return { id: result[0].id!, name: result[0].name ?? sanitized };
}

/**
 * Busca o crea una carpeta (idempotente).
 * Si ya existe en el parent, retorna la existente. Si no, la crea.
 */
export async function ensureDriveFolder(
  name: string,
  parentFolderId: string,
): Promise<DriveFolder> {
  const existing = await findDriveFolder(name, parentFolderId);
  if (existing) return existing;
  return createDriveFolder(name, parentFolderId);
}

/**
 * Crea una jerarquía de carpetas anidadas de forma idempotente.
 * Cada segmento del path se crea (o resuelve) secuencialmente.
 *
 * @param segments — Array de nombres de carpeta, de raíz a hoja.
 *                   Ej: ["Contactos", "Juan García", "Fiscal", "IRPF"]
 * @param rootFolderId — ID del folder padre inicial.
 * @returns — IDs de todas las carpetas creadas/resueltas.
 */
export async function ensureDriveFolderPath(
  segments: string[],
  rootFolderId: string,
): Promise<DriveFolder[]> {
  const folders: DriveFolder[] = [];
  let currentParent = rootFolderId;

  for (const segment of segments) {
    const folder = await ensureDriveFolder(segment, currentParent);
    folders.push(folder);
    currentParent = folder.id;
  }

  return folders;
}
