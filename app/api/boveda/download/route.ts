// ============================================================================
// app/api/boveda/download/route.ts — API: Descarga ZIP de Bóveda Documental
//
// @role: @Doc-Specialist / @Security-CISO
// @spec: Descarga recursiva ZIP con filtrado de confidencialidad
//
// GET /api/boveda/download?contactoId=xxx[&carpetaId=yyy]
//
// Parámetros:
//   contactoId — CUID del contacto (obligatorio)
//   carpetaId  — CUID de carpeta raíz para descarga parcial (opcional)
//
// SEGURIDAD:
//   - El rol del usuario se obtiene de la sesión (Supabase Auth).
//   - Mientras Auth no esté activo, se usa un header x-user-role (dev only).
//   - Staff/Admin: se excluyen carpetas con solo_super_admin (directa + herencia).
//   - SuperAdmin: ve todo sin filtro.
//
// RESPUESTA: application/zip con Content-Disposition attachment.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { carpetaRepository } from "@/lib/modules/entidades/repositories/boveda.repository";
import type { CarpetaConEtiquetaSeguridad } from "@/lib/modules/entidades/repositories/boveda.repository";
import {
  filterCarpetasForZip,
  buildZipPaths,
  generateZipBuffer,
  type CarpetaZipNode,
} from "@/lib/services/bovedaZip.service";
import type { UserSecurityContext, UserRole } from "@/lib/services/securityFilter.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Obtiene el contexto de seguridad del usuario.
 * TODO(Auth): reemplazar por sesión real de Supabase Auth cuando se active.
 */
function getUserContext(req: NextRequest): UserSecurityContext {
  // DEV: permitir override por header (solo en desarrollo)
  const devRole = req.headers.get("x-user-role") as UserRole | null;
  if (devRole && ["SUPER_ADMIN", "ADMIN", "STAFF"].includes(devRole)) {
    return { userId: "dev-user", role: devRole };
  }
  // DEFAULT: STAFF (mínimo privilegio) hasta que Auth esté activo
  return { userId: "anonymous", role: "STAFF" };
}

/**
 * Convierte la lista plana de carpetas con seguridad en un árbol de CarpetaZipNode.
 */
function buildZipTree(flat: CarpetaConEtiquetaSeguridad[]): CarpetaZipNode[] {
  // 1. Crear nodos indexados
  const nodeMap = new Map<string, CarpetaZipNode>();
  for (const c of flat) {
    nodeMap.set(c.id, {
      id:           c.id,
      nombre:       c.nombre,
      tipo:         c.tipo as "INTELIGENTE" | "MANUAL",
      etiqueta_id:  c.etiqueta_id,
      es_blueprint: c.es_blueprint,
      orden:        c.orden,
      solo_super_admin: c.etiqueta?.solo_super_admin ?? false,
      parent_etiqueta_solo_super_admin: c.etiqueta?.parent?.solo_super_admin ?? false,
      archivos: c.archivos.map((a) => ({
        id:         a.id,
        nombre:     a.nombre,
        mime_type:  a.mime_type,
        size_bytes: a.size_bytes,
      })),
      children: [],
    });
  }

  // 2. Vincular padres → hijos
  const roots: CarpetaZipNode[] = [];
  for (const c of flat) {
    const node = nodeMap.get(c.id)!;
    if (c.parent_id && nodeMap.has(c.parent_id)) {
      nodeMap.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 3. Ordenar
  function sortNodes(nodes: CarpetaZipNode[]): void {
    nodes.sort((a, b) => a.orden - b.orden);
    for (const n of nodes) if (n.children.length) sortNodes(n.children);
  }
  sortNodes(roots);

  return roots;
}

/**
 * Busca un subárbol por carpetaId y devuelve solo ese nodo y sus hijos.
 */
function findSubtree(nodes: CarpetaZipNode[], carpetaId: string): CarpetaZipNode | null {
  for (const node of nodes) {
    if (node.id === carpetaId) return node;
    const found = findSubtree(node.children, carpetaId);
    if (found) return found;
  }
  return null;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const contactoId = searchParams.get("contactoId");
  const carpetaId = searchParams.get("carpetaId");

  if (!contactoId) {
    return NextResponse.json(
      { error: "contactoId es obligatorio." },
      { status: 400 },
    );
  }

  // Verificar que el contacto existe
  const contacto = await prisma.contacto.findUnique({
    where: { id: contactoId },
    select: { id: true, nombre: true, apellido1: true, razon_social: true },
  });

  if (!contacto) {
    return NextResponse.json(
      { error: "Contacto no encontrado." },
      { status: 404 },
    );
  }

  // Obtener contexto de seguridad
  const user = getUserContext(req);

  // Cargar carpetas con información de etiqueta para filtrado
  const carpetasFlat = await carpetaRepository.findByContactoWithSecurity(contactoId);

  if (carpetasFlat.length === 0) {
    return NextResponse.json(
      { error: "La bóveda está vacía. No hay carpetas para descargar." },
      { status: 404 },
    );
  }

  // Construir árbol → filtrar por seguridad
  let tree = buildZipTree(carpetasFlat);
  tree = filterCarpetasForZip(tree, user);

  // Si se pidió una carpeta específica, extraer solo ese subárbol
  if (carpetaId) {
    const subtree = findSubtree(tree, carpetaId);
    if (!subtree) {
      return NextResponse.json(
        { error: "Carpeta no encontrada o no tienes acceso." },
        { status: 404 },
      );
    }
    tree = [subtree];
  }

  if (tree.length === 0) {
    return NextResponse.json(
      { error: "No hay carpetas accesibles para descargar." },
      { status: 403 },
    );
  }

  // Generar rutas y ZIP
  const entries = buildZipPaths(tree);
  const buffer = await generateZipBuffer(entries);

  // Nombre del archivo ZIP
  const contactName = contacto.razon_social
    || [contacto.nombre, contacto.apellido1].filter(Boolean).join("_")
    || contacto.id;
  const safeName = contactName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]/g, "_");
  const fileName = carpetaId
    ? `Boveda_${safeName}_parcial.zip`
    : `Boveda_${safeName}.zip`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
