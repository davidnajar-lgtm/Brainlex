"use server";

// ============================================================================
// lib/modules/entidades/actions/evidencias.actions.ts
//
// @role: @Data-Architect / @Security-CISO
// @spec: FASE 13.06 — Documentos Probatorios en Relaciones
//
// Server Actions para vincular/desvincular evidencias a relaciones.
// Drive stub: genera drive_file_id simulado hasta Fase 4.
// AuditLog SIEMPRE antes de mutar.
// ============================================================================

import { revalidatePath } from "next/cache";
import { relacionRepository } from "@/lib/modules/entidades/repositories/relacion.repository";
import { evidenciaRepository } from "@/lib/modules/entidades/repositories/evidencia.repository";
import { auditLogRepository } from "@/lib/modules/entidades/repositories/auditLog.repository";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Queries ───────────────────────────────────────────────────────────────

export async function getEvidenciasDeRelacion(relacionId: string) {
  try {
    const data = await evidenciaRepository.findByRelacion(relacionId);
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar evidencias" } as const;
  }
}

// ─── Vincular evidencia ────────────────────────────────────────────────────

export async function attachEvidencia(input: {
  relacion_id: string;
  contacto_id: string;
  nombre: string;
  mime_type?: string | null;
  size_bytes?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  // Validar nombre
  if (!input.nombre || input.nombre.trim().length === 0) {
    return { ok: false, error: "El nombre del archivo es obligatorio" };
  }
  if (input.nombre.length > 255) {
    return { ok: false, error: "El nombre del archivo no puede superar 255 caracteres" };
  }

  // Validar tamaño
  const MAX_SIZE = 50 * 1024 * 1024;
  if (input.size_bytes && input.size_bytes > MAX_SIZE) {
    return { ok: false, error: "El archivo supera el tamaño máximo de 50MB" };
  }

  // Validar relación existe y está activa
  const relacion = await relacionRepository.findById(input.relacion_id);
  if (!relacion) {
    return { ok: false, error: "Relación no encontrada" };
  }
  if ("activa" in relacion && relacion.activa === false) {
    return { ok: false, error: "No se pueden adjuntar evidencias a una relación archivada" };
  }

  try {
    // Drive stub: genera ID simulado
    const drive_file_id = `stub_${input.relacion_id}_${input.nombre.replace(/[^a-zA-Z0-9]/g, "_")}`;

    // REGLA CISO — AuditLog ANTES de mutar
    await auditLogRepository.append({
      table_name: "evidencias_relacion",
      record_id: input.contacto_id,
      action: "CREATE",
      notes: `Evidencia vinculada a relación ${input.relacion_id}: ${input.nombre}`,
    });

    const ev = await evidenciaRepository.create({
      relacion_id: input.relacion_id,
      nombre: input.nombre.trim(),
      mime_type: input.mime_type ?? null,
      size_bytes: input.size_bytes ?? null,
      drive_file_id,
    });

    revalidatePath(`/contactos/${input.contacto_id}`);
    return { ok: true, data: { id: ev.id } };
  } catch {
    return { ok: false, error: "Error al vincular evidencia" };
  }
}

// ─── Desvincular evidencia ─────────────────────────────────────────────────

export async function detachEvidencia(
  evidenciaId: string,
  contactoId: string
): Promise<ActionResult> {
  const ev = await evidenciaRepository.findById(evidenciaId);
  if (!ev) {
    return { ok: false, error: "Evidencia no encontrada" };
  }

  try {
    // REGLA CISO — AuditLog ANTES de mutar
    await auditLogRepository.append({
      table_name: "evidencias_relacion",
      record_id: contactoId,
      action: "FORGET",
      notes: `Evidencia desvinculada de relación ${ev.relacion_id}: ${ev.nombre}`,
    });

    await evidenciaRepository.delete(evidenciaId);
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al desvincular evidencia" };
  }
}
