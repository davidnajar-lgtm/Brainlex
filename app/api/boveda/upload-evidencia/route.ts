// ============================================================================
// app/api/boveda/upload-evidencia/route.ts
//
// @role: @Integration-Broker / @Security-CISO
// @spec: FASE 13.06 — Upload de evidencias para relaciones
//
// POST: recibe FormData con file + relacion_id + contacto_id
// Fase actual: stub — guarda metadatos en BD, drive_file_id simulado.
// Fase 4+: enviará el archivo real a Google Drive vía driveClient.
// ============================================================================

import { NextResponse } from "next/server";
import { attachEvidencia } from "@/lib/modules/entidades/actions/evidencias.actions";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const relacion_id = formData.get("relacion_id") as string | null;
    const contacto_id = formData.get("contacto_id") as string | null;

    if (!file || !relacion_id || !contacto_id) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios: file, relacion_id, contacto_id" },
        { status: 400 }
      );
    }

    // Fase 4+: aquí se subiría el archivo a Google Drive
    // const driveId = await driveClient.uploadFile(file, drivePath);

    const result = await attachEvidencia({
      relacion_id,
      contacto_id,
      nombre: file.name,
      mime_type: file.type || null,
      size_bytes: file.size || null,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
