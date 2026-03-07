// ============================================================================
// app/api/cron/purge-quarantine/route.ts — Cron: Purga Automática de Cuarentena
//
// @role: Agente Legal + Agente de Rendimiento (Tarea 4)
// @spec: Micro-Spec 1.2 — Automatización del ciclo de vida QUARANTINE
//
// Detecta contactos cuyo quarantine_expires_at ha vencido y los marca
// como candidatos a "Pass Away". Con ?execute=true los elimina físicamente
// si y solo si no tienen dependencias (cero expedientes, facturas, Drive).
//
// SEGURIDAD: Requiere header x-cron-secret = CRON_SECRET (variable de entorno).
// GARANTÍA: Solo opera sobre contactos con status=QUARANTINE + fecha vencida.
// REGLA CISO: AuditLog(FORGET) escrito ANTES de cada borrado físico.
//
// Invocación manual:    GET /api/cron/purge-quarantine
//   → Devuelve lista de candidatos sin eliminar (modo preview).
// Invocación automática: GET /api/cron/purge-quarantine?execute=true
//   → Elimina los candidatos que superen el veto legal.
//
// Integración con Vercel Cron (vercel.json):
//   { "path": "/api/cron/purge-quarantine?execute=true", "schedule": "0 2 * * *" }
// ============================================================================

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { contactoRepository } from "@/lib/repositories/contacto.repository";
import { legalAgent } from "@/lib/services/legalAgent.middleware";
import { prisma } from "@/lib/prisma";

// ─── Autenticación del cron ───────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  const envSecret = process.env.CRON_SECRET;
  if (!envSecret) {
    // En desarrollo sin CRON_SECRET configurado, aceptar si viene desde localhost
    return process.env.NODE_ENV === "development";
  }
  return secret === envSecret;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const execute = req.nextUrl.searchParams.get("execute") === "true";
  const expired = await contactoRepository.findExpiredQuarantine();

  if (expired.length === 0) {
    return NextResponse.json({
      ok:        true,
      timestamp: new Date().toISOString(),
      message:   "No hay contactos con cuarentena vencida.",
      candidates: [],
    });
  }

  const results: {
    id:          string;
    name:        string;
    fiscal_id:   string | null;
    expired_at:  string | null;
    action:      "PURGED" | "VETOED" | "DRY_RUN";
    vetoReasons: string[];
  }[] = [];

  for (const c of expired) {
    const displayName =
      c.razon_social ||
      [c.nombre, c.apellido1].filter(Boolean).join(" ") ||
      c.fiscal_id ||
      c.id;

    // Verificar dependencias en cualquier modo (para informar)
    const deps = await legalAgent.checkLegalDependencies(c.id);

    if (!execute) {
      results.push({
        id:         c.id,
        name:       displayName,
        fiscal_id:  c.fiscal_id ?? null,
        expired_at: c.quarantine_expires_at?.toISOString() ?? null,
        action:     "DRY_RUN",
        vetoReasons: deps.blocked ? deps.reasons : [],
      });
      continue;
    }

    if (deps.blocked) {
      results.push({
        id:         c.id,
        name:       displayName,
        fiscal_id:  c.fiscal_id ?? null,
        expired_at: c.quarantine_expires_at?.toISOString() ?? null,
        action:     "VETOED",
        vetoReasons: deps.reasons,
      });
      continue;
    }

    // SHA-256(fiscal_id|fiscal_id_tipo) — sin PII en el log (RGPD Art.17)
    const hashInput = `${c.fiscal_id ?? ""}|${c.fiscal_id_tipo ?? "UNKNOWN"}`;
    const hash_identificador = createHash("sha256").update(hashInput).digest("hex");

    // AuditLog(FORGET) ANTES del borrado — REGLA CISO — SIN PII
    await contactoRepository.appendAuditLog({
      table_name:         "contactos",
      record_id:          c.id,
      action:             "FORGET",
      // RGPD: sin PII en el log de borrado — omitir campos en lugar de null
      hash_identificador,
      base_legal:         "Purga automática por vencimiento de plazo de cuarentena. Prescripción art.70 GILF / RGPD Art.17.",
      meta_counts: {
        contactos:         1,
        expedientes:       deps.expedientes,
        facturas:          deps.facturas_pendientes,
        documentos_drive:  deps.documentos_drive,
      },
      purgeable:          true,
      notes:              `[CRON/FORGET] Purga automática. Expiró: ${c.quarantine_expires_at?.toISOString()}. Hash verificable sin PII.`,
    });

    await prisma.$transaction([
      prisma.contactoCompanyLink.deleteMany({ where: { contacto_id: c.id } }),
      prisma.contacto.delete({ where: { id: c.id } }),
    ]);

    results.push({
      id:          c.id,
      name:        displayName,
      fiscal_id:   c.fiscal_id ?? null,
      expired_at:  c.quarantine_expires_at?.toISOString() ?? null,
      action:      "PURGED",
      vetoReasons: [],
    });
  }

  if (execute) {
    revalidatePath("/admin/cuarentena");
    revalidatePath("/contactos", "layout");
  }

  const purged = results.filter((r) => r.action === "PURGED").length;
  const vetoed = results.filter((r) => r.action === "VETOED").length;

  return NextResponse.json({
    ok:        true,
    timestamp: new Date().toISOString(),
    execute,
    summary:   { total: expired.length, purged, vetoed, dryRun: !execute ? expired.length : 0 },
    results,
  });
}
