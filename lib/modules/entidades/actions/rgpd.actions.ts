// ============================================================================
// lib/modules/entidades/actions/rgpd.actions.ts — Server Actions: RGPD / Derecho al Olvido
//
// @role: @Security-CISO
// @spec: RGPD Art.17 — Verificador de Registros de Borrado Anonimizados
//
// SEGURIDAD: Devuelve ÚNICAMENTE metadatos no personales (hash, timestamp,
// base_legal, meta_counts). Nunca revela el NIF original ni datos del sujeto.
// ============================================================================
"use server";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type VerifyNifResult =
  | { found: true;  count: number; entries: VerifyEntry[] }
  | { found: false; count: 0 }
  | { found: false; count: 0; error: string };

interface VerifyEntry {
  id:                string;
  hash_identificador: string;
  base_legal:        string | null;
  meta_counts:       unknown;
  created_at:        Date;
}

/**
 * Verifica si existe un registro FORGET anonimizado para un identificador fiscal.
 * Calcula el SHA-256 del (nif + "|" + tipo) y busca coincidencias en audit_logs.
 * No devuelve ningún dato personal del sujeto borrado.
 */
export async function verifyNifDeletion(
  fiscal_id: string,
  fiscal_id_tipo: string
): Promise<VerifyNifResult> {
  const hash = createHash("sha256")
    .update(`${fiscal_id.trim().toUpperCase()}|${fiscal_id_tipo}`)
    .digest("hex");

  let entries;
  try {
    entries = await prisma.auditLog.findMany({
    where: {
      action:             "FORGET",
      hash_identificador: hash,
    },
    select: {
      id:                 true,
      hash_identificador: true,
      base_legal:         true,
      meta_counts:        true,
      created_at:         true,
    },
      orderBy: { created_at: "desc" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { found: false, count: 0, error: msg };
  }

  if (entries.length === 0) {
    return { found: false, count: 0 };
  }

  return {
    found:   true,
    count:   entries.length,
    entries: entries.map((e) => ({
      ...e,
      hash_identificador: e.hash_identificador!, // guaranteed by WHERE clause
    })),
  };
}
