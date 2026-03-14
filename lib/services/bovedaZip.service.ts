// ============================================================================
// lib/services/bovedaZip.service.ts — Generación de ZIP con filtrado de seguridad
//
// @role: @Doc-Specialist / @Security-CISO
// @spec: Descarga recursiva ZIP — estructura jerárquica + confidencialidad
//
// RESPONSABILIDAD:
//   1. Filtrar carpetas según rol del usuario (solo_super_admin + herencia)
//   2. Generar estructura de rutas ZIP replicando la jerarquía de carpetas
//   3. Producir el binario ZIP usando jszip
//
// REGLA DE SEGURIDAD:
//   "La seguridad se aplica en el binario del ZIP."
//   Si el usuario no es SuperAdmin, las carpetas restringidas NO EXISTEN
//   en el archivo ZIP generado — ni como carpetas vacías ni como referencias.
// ============================================================================

import JSZip from "jszip";
import type { UserSecurityContext } from "./securityFilter.service";
import type { ArchivoMin } from "./bovedaTree.service";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface CarpetaZipNode {
  id:       string;
  nombre:   string;
  tipo:     "INTELIGENTE" | "MANUAL";
  etiqueta_id:  string | null;
  es_blueprint: boolean;
  orden:    number;
  /** Flag directo de la etiqueta asociada. */
  solo_super_admin: boolean;
  /** Flag heredado: true si el departamento padre tiene solo_super_admin=true. */
  parent_etiqueta_solo_super_admin: boolean;
  archivos: ArchivoMin[];
  children: CarpetaZipNode[];
}

export interface ZipEntry {
  /** Ruta dentro del ZIP (e.g. "Fiscal/IVA/Documentos/factura.pdf"). Termina en "/" si es carpeta vacía. */
  zipPath:    string;
  /** ID del archivo en BD. null si es una carpeta vacía (directorio). */
  archivoId:  string | null;
  /** Tamaño en bytes (informativo). null para directorios. */
  sizeBytes:  number | null;
}

// ─── Filtrado de seguridad ─────────────────────────────────────────────────

/**
 * Filtra recursivamente el árbol de carpetas según el rol del usuario.
 *
 * Reglas (para no-SuperAdmin):
 *   A) Carpeta con solo_super_admin=true → EXCLUIDA (y todos sus hijos)
 *   B) Carpeta con parent_etiqueta_solo_super_admin=true → EXCLUIDA (herencia)
 *   C) Carpeta MANUAL sin etiqueta → SIEMPRE incluida
 *
 * SuperAdmin: bypass total, devuelve el árbol sin modificar.
 */
export function filterCarpetasForZip(
  nodes: CarpetaZipNode[],
  user: UserSecurityContext,
): CarpetaZipNode[] {
  if (user.role === "SUPER_ADMIN") return nodes;

  return nodes
    .filter((node) => {
      // Exclusión directa
      if (node.solo_super_admin) return false;
      // Herencia: padre restringido
      if (node.parent_etiqueta_solo_super_admin) return false;
      return true;
    })
    .map((node) => ({
      ...node,
      // Filtrar hijos recursivamente
      children: filterCarpetasForZip(node.children, user),
    }));
}

// ─── Generación de rutas ZIP ───────────────────────────────────────────────

/**
 * Convierte un árbol de CarpetaZipNode en una lista plana de ZipEntry
 * con rutas jerárquicas (e.g. "Dept/Servicio/Blueprint/archivo.pdf").
 *
 * Las carpetas sin archivos ni hijos se representan como directorios
 * (zipPath termina en "/") para preservar la estructura.
 */
export function buildZipPaths(
  nodes: CarpetaZipNode[],
  prefix = "",
): ZipEntry[] {
  const entries: ZipEntry[] = [];

  for (const node of nodes) {
    const folderPath = prefix ? `${prefix}/${node.nombre}` : node.nombre;

    // Archivos dentro de esta carpeta
    for (const archivo of node.archivos) {
      entries.push({
        zipPath: `${folderPath}/${archivo.nombre}`,
        archivoId: archivo.id,
        sizeBytes: archivo.size_bytes,
      });
    }

    // Recurse children
    const childEntries = buildZipPaths(node.children, folderPath);
    entries.push(...childEntries);

    // Si no tiene archivos ni hijos, incluir como directorio vacío
    if (node.archivos.length === 0 && node.children.length === 0) {
      entries.push({
        zipPath: `${folderPath}/`,
        archivoId: null,
        sizeBytes: null,
      });
    }
  }

  return entries;
}

// ─── Generación del binario ZIP ────────────────────────────────────────────

/**
 * Genera un Buffer con el archivo ZIP completo.
 *
 * FASE ACTUAL (mock): los archivos se representan como placeholders de texto
 * con su nombre y tamaño. En Fase 4+ (Google Drive activo), cada archivoId
 * se descargará vía Drive API y se incluirá el binario real.
 *
 * @param entries - Lista de ZipEntry (ya filtrada por seguridad)
 * @param onProgress - Callback opcional para progreso (0..1)
 */
export async function generateZipBuffer(
  entries: ZipEntry[],
  onProgress?: (percent: number) => void,
): Promise<Buffer> {
  const zip = new JSZip();
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.archivoId === null) {
      // Directorio vacío
      zip.folder(entry.zipPath.replace(/\/$/, ""));
    } else {
      // FASE MOCK: placeholder con metadatos.
      // TODO(Fase 4): sustituir por descarga real desde Google Drive API.
      const placeholder = `[BRAINLEX — Placeholder]\nArchivo: ${entry.zipPath.split("/").pop()}\nID: ${entry.archivoId}\nTamaño original: ${entry.sizeBytes ?? "desconocido"} bytes\n\nEste archivo se descargará desde Google Drive cuando la integración esté activa (Fase 4+).`;
      zip.file(entry.zipPath, placeholder);
    }

    if (onProgress) {
      onProgress((i + 1) / total);
    }
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return buffer;
}
