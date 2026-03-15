"use server";

// ============================================================================
// lib/modules/entidades/actions/relaciones.actions.ts
//
// @role: @Data-Architect
// @spec: Motor de Clasificación Multidimensional — Grafo de Relaciones
//
// Server Actions para TipoRelacion y Relacion entre Contactos.
// Solo Admin puede crear/editar/borrar TipoRelacion.
// Cualquier usuario autenticado puede crear/borrar Relaciones entre contactos.
// ============================================================================

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ContactoStatus, ContactoTipo, type EtiquetaScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  tipoRelacionRepository,
  relacionRepository,
} from "@/lib/modules/entidades/repositories/relacion.repository";
import { auditLogRepository } from "@/lib/modules/entidades/repositories/auditLog.repository";

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const TipoRelacionSchema = z.object({
  nombre:      z.string().min(1).max(80),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido").default("#6b7280"),
  categoria:   z.string().min(1).max(60),
  descripcion: z.string().max(300).optional(),
});

const RelacionSchema = z.object({
  origen_id:             z.string().cuid(),
  destino_id:            z.string().cuid(),
  tipo_relacion_id:      z.string().cuid(),
  notas:                 z.string().max(500).optional(),
  cargo:                 z.string().max(120).optional(),
  departamento_interno:  z.string().max(120).optional(),
  sede_vinculada_id:     z.string().cuid().optional(),
  porcentaje:            z.number().min(0).max(100).optional(),
});

// ─── Tipos de retorno ─────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ─── TipoRelacion ─────────────────────────────────────────────────────────────

export async function getTiposRelacion() {
  try {
    const data = await tipoRelacionRepository.findAll();
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar tipos de relación" } as const;
  }
}

/** Filtra tipos por scope del tenant activo (GLOBAL + tenant-specific). */
export async function getTiposRelacionByScope(tenantScope: EtiquetaScope) {
  try {
    const data = await tipoRelacionRepository.findByScope(tenantScope);
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar tipos de relación" } as const;
  }
}

export async function createTipoRelacion(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const parsed = TipoRelacionSchema.safeParse({
    nombre:      formData.get("nombre"),
    color:       formData.get("color") ?? "#6b7280",
    categoria:   formData.get("categoria"),
    descripcion: formData.get("descripcion") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const tipo = await tipoRelacionRepository.create(parsed.data);
    revalidatePath("/admin/relaciones");
    return { ok: true, data: { id: tipo.id } };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ya existe un tipo de relación con ese nombre" };
    }
    return { ok: false, error: "Error al crear el tipo de relación" };
  }
}

export async function updateTipoRelacion(
  id: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const tipo = await tipoRelacionRepository.findById(id);
  if (!tipo) return { ok: false, error: "Tipo de relación no encontrado" };

  const parsed = TipoRelacionSchema.partial().safeParse({
    nombre:      formData.get("nombre") || undefined,
    color:       formData.get("color")  || undefined,
    categoria:   formData.get("categoria") || undefined,
    descripcion: formData.get("descripcion") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await tipoRelacionRepository.update(id, parsed.data);
    revalidatePath("/admin/relaciones");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar el tipo de relación" };
  }
}

export async function deleteTipoRelacion(id: string): Promise<ActionResult> {
  const tipo = await tipoRelacionRepository.findById(id);
  if (!tipo) return { ok: false, error: "Tipo de relación no encontrado" };

  const count = await tipoRelacionRepository.countRelaciones(id);
  if (count > 0) {
    return {
      ok: false,
      error: `No se puede borrar: hay ${count} relación(es) activa(s) que usan este tipo.`,
    };
  }
  try {
    await tipoRelacionRepository.delete(id);
    revalidatePath("/admin/relaciones");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al borrar el tipo de relación" };
  }
}

/** Actualiza el scope de un TipoRelacion (patrón Taxonomía). */
export async function updateTipoRelacionScope(
  id: string,
  scope: EtiquetaScope
): Promise<ActionResult> {
  try {
    await tipoRelacionRepository.update(id, { scope });
    revalidatePath("/admin/relaciones");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al cambiar el scope" };
  }
}

// ─── Relaciones entre Contactos ───────────────────────────────────────────────

export async function getRelacionesDeContacto(contactoId: string) {
  try {
    const data = await relacionRepository.findByContacto(contactoId);
    return { ok: true, data } as const;
  } catch (err) {
    console.error("[getRelacionesDeContacto] Error:", err);
    return { ok: false, error: "Error al cargar relaciones" } as const;
  }
}

export async function createRelacion(input: {
  origen_id:             string;
  destino_id:            string;
  tipo_relacion_id:      string;
  notas?:                string;
  cargo?:                string;
  departamento_interno?: string;
  sede_vinculada_id?:    string;
  porcentaje?:           number;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = RelacionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (parsed.data.origen_id === parsed.data.destino_id) {
    return { ok: false, error: "Un contacto no puede relacionarse consigo mismo" };
  }
  try {
    // Resolver nombres para AuditLog legible
    const [tipo, destino] = await Promise.all([
      tipoRelacionRepository.findById(parsed.data.tipo_relacion_id),
      prisma.contacto.findUnique({
        where: { id: parsed.data.destino_id },
        select: { nombre: true, apellido1: true, razon_social: true, tipo: true },
      }),
    ]);
    const tipoNombre = tipo?.nombre ?? "Tipo desconocido";
    const destinoNombre = destino
      ? destino.tipo === "PERSONA_JURIDICA"
        ? destino.razon_social ?? "—"
        : [destino.nombre, destino.apellido1].filter(Boolean).join(" ") || "—"
      : "Contacto desconocido";

    const rel = await relacionRepository.create(parsed.data);

    // REGLA CISO — AuditLog (record_id = contacto origen para que aparezca en su ficha)
    const extras: string[] = [];
    if (parsed.data.cargo) extras.push(`cargo: ${parsed.data.cargo}`);
    if (parsed.data.porcentaje != null) extras.push(`participación: ${parsed.data.porcentaje}%`);
    await auditLogRepository.append({
      table_name: "relaciones",
      record_id: parsed.data.origen_id,
      action: "CREATE",
      notes: `Nueva relación "${tipoNombre}" con ${destinoNombre}${extras.length ? ` (${extras.join(", ")})` : ""}`,
    });

    revalidatePath(`/contactos/${parsed.data.origen_id}`);
    revalidatePath(`/contactos/${parsed.data.destino_id}`);
    return { ok: true, data: { id: rel.id } };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ya existe esta relación entre los dos contactos" };
    }
    return { ok: false, error: "Error al crear la relación" };
  }
}

export async function deleteRelacion(
  id: string,
  contactoId: string
): Promise<ActionResult> {
  try {
    // Resolver nombre de relación para AuditLog legible
    const rel = await relacionRepository.findById(id);
    const relLabel = rel
      ? `"${rel.tipo_relacion.nombre}" con ${
          rel.origen_id === contactoId
            ? (rel.destino.razon_social ?? [rel.destino.nombre, rel.destino.apellido1].filter(Boolean).join(" ")) || "—"
            : (rel.origen.razon_social ?? [rel.origen.nombre, rel.origen.apellido1].filter(Boolean).join(" ")) || "—"
        }`
      : "desconocida";

    // REGLA CISO — Auditar evidencias ANTES del CASCADE (se perderán con la relación)
    const evidencias = await prisma.evidenciaRelacion.findMany({
      where: { relacion_id: id },
      select: { id: true, nombre: true },
    });
    if (evidencias.length > 0) {
      const nombres = evidencias.map((e) => e.nombre).join(", ");
      await auditLogRepository.append({
        table_name: "evidencias_relacion",
        record_id: contactoId,
        action: "FORGET",
        notes: `${evidencias.length} documento(s) probatorio(s) eliminados con la relación ${relLabel}: ${nombres}`,
      });
    }

    // REGLA CISO — AuditLog ANTES de mutar
    await auditLogRepository.append({
      table_name: "relaciones",
      record_id: contactoId,
      action: "FORGET",
      notes: `Relación ${relLabel} eliminada permanentemente`,
    });

    await relacionRepository.delete(id);
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al borrar la relación" };
  }
}

/**
 * Soft-delete: archiva la relación (activa=false) con motivo y fecha.
 * El historial queda visible en la pestaña Ecosistema.
 */
export async function archiveRelacion(
  id: string,
  contactoId: string,
  motivo: string
): Promise<ActionResult> {
  try {
    // Resolver nombre para AuditLog legible
    const rel = await relacionRepository.findById(id);
    const relLabel = rel
      ? `"${rel.tipo_relacion.nombre}" con ${
          rel.origen_id === contactoId
            ? (rel.destino.razon_social ?? [rel.destino.nombre, rel.destino.apellido1].filter(Boolean).join(" ")) || "—"
            : (rel.origen.razon_social ?? [rel.origen.nombre, rel.origen.apellido1].filter(Boolean).join(" ")) || "—"
        }`
      : "desconocida";

    // REGLA CISO — AuditLog ANTES de mutar
    await auditLogRepository.append({
      table_name: "relaciones",
      record_id: contactoId,
      action: "QUARANTINE",
      notes: `Relación ${relLabel} archivada — motivo: ${motivo}`,
    });

    await relacionRepository.archive(id, motivo);
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al archivar la relación" };
  }
}

/**
 * Restaura una relación archivada a estado activo.
 */
export async function restoreRelacion(
  id: string,
  contactoId: string
): Promise<ActionResult> {
  try {
    // Resolver nombre para AuditLog legible
    const rel = await relacionRepository.findById(id);
    const relLabel = rel
      ? `"${rel.tipo_relacion.nombre}" con ${
          rel.origen_id === contactoId
            ? (rel.destino.razon_social ?? [rel.destino.nombre, rel.destino.apellido1].filter(Boolean).join(" ")) || "—"
            : (rel.origen.razon_social ?? [rel.origen.nombre, rel.origen.apellido1].filter(Boolean).join(" ")) || "—"
        }`
      : "desconocida";

    // REGLA CISO — AuditLog ANTES de mutar
    await auditLogRepository.append({
      table_name: "relaciones",
      record_id: contactoId,
      action: "RESTORE",
      notes: `Relación ${relLabel} restaurada desde archivo`,
    });

    await relacionRepository.restore(id);
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al restaurar la relación" };
  }
}

/**
 * Carga relaciones archivadas (históricas) de un contacto.
 */
export async function getRelacionesArchivadas(contactoId: string) {
  try {
    const data = await relacionRepository.findArchivedByContacto(contactoId);
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar relaciones archivadas" } as const;
  }
}

// ─── Búsqueda de Contactos para Picker ──────────────────────────────────────

export type ContactoPickerItem = {
  id: string;
  displayName: string;
  fiscal_id: string | null;
  tipo: ContactoTipo;
};

/**
 * Busca contactos ACTIVE por nombre, razón social o NIF.
 * Excluye el contacto actual (excludeId) para evitar auto-relaciones.
 * Límite: 10 resultados (picker, no listado).
 */
export async function searchContactosForPicker(
  query: string,
  excludeId: string
): Promise<{ ok: true; data: ContactoPickerItem[] } | { ok: false; error: string }> {
  if (!query.trim() || query.trim().length < 2) {
    return { ok: true, data: [] };
  }
  try {
    const q = query.trim();
    const contacts = await prisma.contacto.findMany({
      where: {
        status: ContactoStatus.ACTIVE,
        id: { not: excludeId },
        OR: [
          { nombre:       { contains: q, mode: "insensitive" } },
          { apellido1:    { contains: q, mode: "insensitive" } },
          { razon_social: { contains: q, mode: "insensitive" } },
          { fiscal_id:    { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, nombre: true, apellido1: true, apellido2: true, razon_social: true, fiscal_id: true, tipo: true },
      take: 10,
      orderBy: { created_at: "desc" },
    });
    const data: ContactoPickerItem[] = contacts.map((c) => ({
      id: c.id,
      displayName:
        c.tipo === ContactoTipo.PERSONA_JURIDICA
          ? c.razon_social ?? "—"
          : [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(" ") || "—",
      fiscal_id: c.fiscal_id,
      tipo: c.tipo,
    }));
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Error al buscar contactos" };
  }
}

// ─── Direcciones para Sede Vinculada ─────────────────────────────────────────

export type DireccionPickerItem = {
  id: string;
  label: string;
  tipo: string;
};

/**
 * Obtiene las direcciones de un contacto formateadas para selector de sede.
 * Se usa en el formulario de creación de relación para vincular una sede.
 */
export async function getDireccionesForPicker(
  contactoId: string
): Promise<{ ok: true; data: DireccionPickerItem[] } | { ok: false; error: string }> {
  try {
    const direcciones = await prisma.direccion.findMany({
      where: { contactoId },
      select: { id: true, tipo: true, etiqueta: true, calle: true, ciudad: true, provincia: true },
      orderBy: [{ es_principal: "desc" }, { tipo: "asc" }],
    });
    const data: DireccionPickerItem[] = direcciones.map((d) => {
      const tipoLabel = d.tipo === "WORKPLACE" && d.etiqueta ? d.etiqueta : d.tipo;
      const parts = [d.calle, d.ciudad, d.provincia].filter(Boolean);
      return { id: d.id, label: `${tipoLabel} — ${parts.join(", ")}`, tipo: d.tipo };
    });
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Error al cargar direcciones" };
  }
}

/**
 * Actualiza campos editables de una Relación existente.
 */
export async function updateRelacion(
  id: string,
  contactoId: string,
  data: {
    notas?:                string | null;
    cargo?:                string | null;
    departamento_interno?: string | null;
    sede_vinculada_id?:    string | null;
    porcentaje?:           number | null;
  }
): Promise<ActionResult> {
  try {
    // Resolver nombre para AuditLog legible
    const rel = await relacionRepository.findById(id);
    const relLabel = rel
      ? `"${rel.tipo_relacion.nombre}" con ${
          rel.origen_id === contactoId
            ? (rel.destino.razon_social ?? [rel.destino.nombre, rel.destino.apellido1].filter(Boolean).join(" ")) || "—"
            : (rel.origen.razon_social ?? [rel.origen.nombre, rel.origen.apellido1].filter(Boolean).join(" ")) || "—"
        }`
      : "desconocida";

    // REGLA CISO — AuditLog ANTES de mutar (lenguaje humano)
    const FIELD_LABELS: Record<string, string> = {
      cargo: "Cargo",
      departamento_interno: "Departamento",
      notas: "Notas",
      sede_vinculada_id: "Sede vinculada",
      porcentaje: "Participación",
    };
    const parts: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const label = FIELD_LABELS[key] ?? key;
      if (value === null) {
        parts.push(`${label} eliminado`);
      } else if (key === "porcentaje") {
        parts.push(`${label}: ${value}%`);
      } else if (key === "sede_vinculada_id") {
        // Resolver dirección para mostrar algo legible
        const dir = await prisma.direccion.findUnique({
          where: { id: value as string },
          select: { calle: true, ciudad: true },
        });
        parts.push(`${label}: ${dir ? [dir.calle, dir.ciudad].filter(Boolean).join(", ") : "actualizada"}`);
      } else {
        parts.push(`${label}: ${value}`);
      }
    }
    if (parts.length > 0) {
      await auditLogRepository.append({
        table_name: "relaciones",
        record_id: contactoId,
        action: "UPDATE",
        notes: `Relación ${relLabel} editada — ${parts.join("; ")}`,
      });
    }

    await relacionRepository.update(id, data);
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al actualizar la relación" };
  }
}
