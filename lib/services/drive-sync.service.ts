// ============================================================================
// lib/services/drive-sync.service.ts — @File-Mirror: Notario de Drive
//
// @role: @Doc-Specialist / @File-Mirror
// @spec: Motor de Clasificación Multidimensional — Sincronización Drive
//
// MISIÓN: Traducir etiquetas de DEPARTAMENTO y SERVICIO en rutas físicas
// de Google Drive, manteniendo la estructura de carpetas sincronizada
// con la taxonomía SALI.
//
// MAPEO AUTORIZADO POR EL CEO:
//   CategoriaEtiqueta "Departamento" → Google Drive Nivel 1
//   CategoriaEtiqueta "Servicio"     → Google Drive Nivel 2
//
// LIMITACIONES (@File-Mirror):
//   ✅ Puede CREAR carpetas
//   ✅ Puede MOVER carpetas
//   ❌ NUNCA borra archivos sin confirmación manual de seguridad
//
// ESTADO: STUB — pendiente de integración con Google Drive API
//         Activar cuando Drive API esté configurada (Fase 4)
// ============================================================================

export type DriveFolderLevel = 1 | 2;

export interface DriveSyncEvent {
  entidad_id:   string;
  entidad_tipo: "CONTACTO" | "EXPEDIENTE";
  etiqueta_id:  string;
  etiqueta_nombre: string;
  categoria_nombre: string;
  action:       "ASSIGN" | "UNASSIGN";
  timestamp:    Date;
}

export interface DriveFolderPath {
  level:  DriveFolderLevel;
  nombre: string;
  path:   string; /// Ruta Drive relativa: "Departamento/Juridico" | "Servicio/Herencia"
}

// ─── Mapeo de categorías a nivel de carpeta ───────────────────────────────────

const CATEGORIA_TO_DRIVE_LEVEL: Record<string, DriveFolderLevel> = {
  "Departamento": 1, // → Nivel 1: carpeta raíz del área
  "Servicio":     2, // → Nivel 2: subcarpeta dentro del departamento
};

// ─── DriveSyncService ─────────────────────────────────────────────────────────

export const DriveSyncService = {
  /**
   * Determina si una categoría de etiqueta mapea a una carpeta Drive.
   * Solo "Departamento" y "Servicio" tienen mapeo (@File-Mirror).
   */
  isSyncable(categoria_nombre: string): boolean {
    return categoria_nombre in CATEGORIA_TO_DRIVE_LEVEL;
  },

  /**
   * Traduce una etiqueta a su ruta Drive correspondiente.
   * Retorna null si la categoría no tiene mapeo.
   */
  resolvePath(categoria_nombre: string, etiqueta_nombre: string): DriveFolderPath | null {
    const level = CATEGORIA_TO_DRIVE_LEVEL[categoria_nombre];
    if (!level) return null;

    const sanitized = etiqueta_nombre.trim().replace(/[/\\:*?"<>|]/g, "_");
    return {
      level,
      nombre: sanitized,
      path:   `${categoria_nombre}/${sanitized}`,
    };
  },

  /**
   * @File-Mirror — Procesa un evento de asignación/desvinculación de etiqueta.
   *
   * STUB: registra el evento pero no ejecuta operaciones reales en Drive
   * hasta que la integración con Google Drive API esté activa (Fase 4).
   *
   * REGLA DE SEGURIDAD: en UNASSIGN nunca se borra la carpeta.
   * Solo se registra el evento para revisión manual.
   */
  async onEtiquetaEvent(event: DriveSyncEvent): Promise<void> {
    if (!this.isSyncable(event.categoria_nombre)) return;

    const folderPath = this.resolvePath(event.categoria_nombre, event.etiqueta_nombre);
    if (!folderPath) return;

    if (event.action === "ASSIGN") {
      // TODO (Fase 4): Crear carpeta en Drive si no existe
      // await driveClient.folders.ensureExists(folderPath.path, tenantRootId);
      console.log(
        `[@File-Mirror] ASSIGN → ${folderPath.path} (L${folderPath.level})`,
        `| entidad: ${event.entidad_tipo}:${event.entidad_id}`
      );
    }

    if (event.action === "UNASSIGN") {
      // REGLA: NUNCA borrar carpeta automáticamente.
      // Solo registrar para revisión manual del CEO.
      console.log(
        `[@File-Mirror] UNASSIGN (sin borrado) → ${folderPath.path}`,
        `| requiere confirmación manual de seguridad`
      );
    }
  },
};
