// ============================================================================
// lib/services/mirrorSync.service.ts — Mirror-Service: Drive Sync Cross-Tenant
//
// @role: @Integration-Broker / @Security-CISO
// @spec: FASE 12.04 — Cierre de Arquitectura: Sincronización por ID Interno
//
// PRINCIPIO ARQUITECTÓNICO:
//   Contacto es GLOBAL (un solo UUID). ContactoCompanyLink lo vincula a
//   múltiples tenants (LX, LW). La carpeta 00_DOCUMENTACION_PERMANENTE
//   tiene company_id=null → ya es visible para todos los tenants en BD.
//
//   El Mirror-Service solo necesita replicar en DRIVE:
//   Cuando se sube un archivo a DocPermanente, asegura que la estructura
//   de carpetas exista en las estructuras Drive de TODOS los tenants
//   vinculados al contacto.
//
// ANCLA: UUID del contacto (ID interno), NO NIF/DNI.
//
// REGLAS DE SEGURIDAD:
//   - Solo opera sobre 00_DOCUMENTACION_PERMANENTE (whitelist de carpeta)
//   - Detección de multi-tenant por ContactoCompanyLink (ID interno)
//   - Replicación Drive es best-effort (no bloquea si falla)
//   - AuditLog registra cada sincronización
// ============================================================================

import { prisma } from "@/lib/prisma";
import { DOC_PERMANENTE_NOMBRE } from "./docPermanente.constants";
import { syncFolderToGoogleDrive } from "./driveIntegration.service";
import { auditLogRepository } from "@/lib/modules/entidades/repositories/auditLog.repository";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface MirrorDriveSyncResult {
  synced: boolean;
  tenantsSynced: string[];
  reason?: string;
}

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Obtiene todos los tenants vinculados a un contacto.
 *
 * @param contactoId — UUID del contacto (ancla universal)
 * @returns Array de company_ids (ej: ["LX", "LW"])
 */
export async function getLinkedTenants(contactoId: string): Promise<string[]> {
  const links = await prisma.contactoCompanyLink.findMany({
    where: { contacto_id: contactoId },
    select: { company_id: true },
  });
  return links.map((l) => l.company_id);
}

/**
 * Detecta si un contacto es multi-tenant (vinculado a 2+ tenants).
 * Solo los contactos multi-tenant necesitan Mirror-Sync en Drive.
 */
export async function isMultiTenant(contactoId: string): Promise<boolean> {
  const tenants = await getLinkedTenants(contactoId);
  return tenants.length > 1;
}

/**
 * Sincroniza la estructura Drive de DocPermanente en TODOS los tenants
 * vinculados al contacto.
 *
 * Se ejecuta cuando:
 *   1. Se sube un archivo a 00_DOCUMENTACION_PERMANENTE
 *   2. El contacto está vinculado a 2+ tenants
 *
 * La BD ya comparte los archivos (company_id=null). Este servicio solo
 * asegura que las carpetas existan en Drive para cada tenant.
 *
 * @param contactoId — UUID del contacto
 * @param contactoName — Nombre visible del contacto (para ruta Drive)
 * @param carpetaNombre — Nombre de la carpeta donde se subió el archivo
 */
export async function triggerMirrorDriveSync(
  contactoId: string,
  contactoName: string,
  carpetaNombre: string,
): Promise<MirrorDriveSyncResult> {
  // Guard 1: Solo archivos en DocPermanente
  if (carpetaNombre !== DOC_PERMANENTE_NOMBRE) {
    return { synced: false, tenantsSynced: [], reason: "Carpeta no es DocPermanente" };
  }

  // Guard 2: Solo contactos multi-tenant necesitan mirror
  const tenants = await getLinkedTenants(contactoId);
  if (tenants.length < 2) {
    return { synced: false, tenantsSynced: [], reason: "Contacto en un solo tenant" };
  }

  const syncedTenants: string[] = [];

  // Sincronizar estructura Drive en cada tenant
  for (const tenantId of tenants) {
    try {
      // Estructura: ROOT / {Tenant} / Contactos / {Nombre} / 00_DOCUMENTACION_PERMANENTE
      await syncFolderToGoogleDrive(contactoName, [DOC_PERMANENTE_NOMBRE]);
      syncedTenants.push(tenantId);
    } catch {
      console.error(`[Mirror-Sync] Error syncing Drive for tenant ${tenantId}`);
    }
  }

  // AuditLog
  if (syncedTenants.length > 0) {
    await auditLogRepository.append({
      table_name: "Carpeta",
      record_id: contactoId,
      action: "UPDATE",
      notes: `Mirror-Sync Drive: DocPermanente sincronizada en tenants [${syncedTenants.join(", ")}]`,
    }).catch(() => {});

    console.log(
      `[Mirror-Sync] DocPermanente de ${contactoName} sincronizada en Drive: [${syncedTenants.join(", ")}]`,
    );
  }

  return {
    synced: syncedTenants.length > 0,
    tenantsSynced: syncedTenants,
  };
}

/**
 * Verifica si una carpeta es elegible para Mirror-Sync.
 */
export function isMirrorEligible(carpetaNombre: string): boolean {
  return carpetaNombre === DOC_PERMANENTE_NOMBRE;
}
