// ============================================================================
// app/api/backfill-audit/route.ts — Endpoint one-shot para backfill de AuditLog
//
// Ejecutar: GET /api/backfill-audit
// Idempotente — seguro de ejecutar múltiples veces.
// ============================================================================

import { NextResponse } from "next/server";
import { backfillAuditLogs } from "@/lib/modules/entidades/actions/backfill-audit.action";

export async function GET() {
  try {
    const result = await backfillAuditLogs();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
