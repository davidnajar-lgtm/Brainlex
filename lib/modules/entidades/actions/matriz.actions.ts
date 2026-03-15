"use server";

// ============================================================================
// lib/modules/entidades/actions/matriz.actions.ts — Resolución de Matriz
//
// Server Action que resuelve el contacto-matriz del tenant activo.
// Usado por el botón "Mi Empresa" del Sidebar para navegación directa.
//
// SEGURIDAD CISO:
//   · El tenantId se pasa desde el cliente (TenantContext) — en Fase 5 se
//     cruzará con el JWT de Supabase Auth para verificar pertenencia.
//   · Solo retorna contactos con es_facturadora=true AND status=ACTIVE
//     vinculados al tenant solicitado.
//   · Nunca expone datos cruzados entre tenants.
// ============================================================================

import { prisma } from "@/lib/prisma";

interface MatrizResult {
  ok: boolean;
  contactoId: string | null;
}

/**
 * Busca el contacto-matriz (es_facturadora=true) vinculado al tenant dado.
 *
 * @param tenantId — "LX" | "LW"
 * @returns { ok: true, contactoId: string } | { ok: true, contactoId: null }
 */
export async function getMatrizContactId(tenantId: string): Promise<MatrizResult> {
  const link = await prisma.contactoCompanyLink.findFirst({
    where: {
      company_id: tenantId,
      contacto: {
        es_facturadora: true,
        status: "ACTIVE",
      },
    },
    select: { contacto_id: true },
  });

  return { ok: true, contactoId: link?.contacto_id ?? null };
}
