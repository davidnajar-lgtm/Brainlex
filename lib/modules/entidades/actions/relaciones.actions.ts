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
import {
  tipoRelacionRepository,
  relacionRepository,
} from "@/lib/modules/entidades/repositories/relacion.repository";

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const TipoRelacionSchema = z.object({
  nombre:      z.string().min(1).max(80),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido").default("#6b7280"),
  categoria:   z.string().min(1).max(60),
  descripcion: z.string().max(300).optional(),
});

const RelacionSchema = z.object({
  origen_id:        z.string().cuid(),
  destino_id:       z.string().cuid(),
  tipo_relacion_id: z.string().cuid(),
  notas:            z.string().max(500).optional(),
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
  if (tipo.es_sistema) return { ok: false, error: "Los tipos de sistema no son editables" };

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
  if (tipo.es_sistema) return { ok: false, error: "Los tipos de sistema no se pueden borrar" };

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

// ─── Relaciones entre Contactos ───────────────────────────────────────────────

export async function getRelacionesDeContacto(contactoId: string) {
  try {
    const data = await relacionRepository.findByContacto(contactoId);
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "Error al cargar relaciones" } as const;
  }
}

export async function createRelacion(input: {
  origen_id:        string;
  destino_id:       string;
  tipo_relacion_id: string;
  notas?:           string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = RelacionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (parsed.data.origen_id === parsed.data.destino_id) {
    return { ok: false, error: "Un contacto no puede relacionarse consigo mismo" };
  }
  try {
    const rel = await relacionRepository.create(parsed.data);
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
    await relacionRepository.delete(id);
    revalidatePath(`/contactos/${contactoId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Error al borrar la relación" };
  }
}
