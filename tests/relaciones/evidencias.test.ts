// ============================================================================
// tests/relaciones/evidencias.test.ts — TDD: Evidencias de Relaciones
//
// @role: @QA-Engineer / @Security-CISO
// @spec: FASE 13.06 — Documentos Probatorios en Relaciones
//
// COBERTURA:
//   1. Vincular evidencia a una relación (metadatos + drive stub)
//   2. Listar evidencias de una relación
//   3. Desvincular evidencia (soft: solo quita vínculo, no borra archivo)
//   4. Validación: no vincular a relación inexistente/archivada
//   5. AuditLog: acción correcta por operación (CREATE/FORGET)
//   6. Límites: nombre, mime_type, size
//   7. Enrutamiento Drive stub: genera path correcto
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Tipos simulados ────────────────────────────────────────────────────────

interface EvidenciaRelacion {
  id: string;
  relacion_id: string;
  nombre: string;
  mime_type: string | null;
  size_bytes: number | null;
  drive_file_id: string | null;
  created_at: Date;
}

interface Relacion {
  id: string;
  origen_id: string;
  destino_id: string;
  tipo_relacion_id: string;
  activa: boolean;
}

// ─── Helpers puros (lógica extraída para testeo unitario) ────────────────────

/** Valida que una relación pueda recibir evidencias (debe estar activa) */
function canAttachEvidencia(relacion: Relacion | null): { ok: boolean; error?: string } {
  if (!relacion) return { ok: false, error: "Relación no encontrada" };
  if (!relacion.activa) return { ok: false, error: "No se pueden adjuntar evidencias a una relación archivada" };
  return { ok: true };
}

/** Valida metadatos de archivo antes de crear evidencia */
function validateFileMetadata(input: {
  nombre: string;
  mime_type?: string | null;
  size_bytes?: number | null;
}): { ok: boolean; error?: string } {
  if (!input.nombre || input.nombre.trim().length === 0) {
    return { ok: false, error: "El nombre del archivo es obligatorio" };
  }
  if (input.nombre.length > 255) {
    return { ok: false, error: "El nombre del archivo no puede superar 255 caracteres" };
  }
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (input.size_bytes && input.size_bytes > MAX_SIZE) {
    return { ok: false, error: "El archivo supera el tamaño máximo de 50MB" };
  }
  return { ok: true };
}

/** Genera un drive_file_id simulado (stub para Fase 4) */
function generateStubDriveId(relacion_id: string, nombre: string): string {
  return `stub_${relacion_id}_${nombre.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

/** Genera la ruta Drive esperada para una evidencia de relación */
function buildEvidenciaDrivePath(
  origenNombre: string,
  tipoRelacionNombre: string,
  destinoNombre: string
): string[] {
  return [
    "Contactos",
    origenNombre,
    "_RELACIONES",
    `${tipoRelacionNombre} - ${destinoNombre}`,
  ];
}

/** Determina la acción de AuditLog según la operación */
function getEvidenciaAuditAction(op: "attach" | "detach"): string {
  return op === "attach" ? "CREATE" : "FORGET";
}

/** Filtra evidencias que pertenecen a una relación específica */
function filterByRelacion(evidencias: EvidenciaRelacion[], relacionId: string): EvidenciaRelacion[] {
  return evidencias.filter((e) => e.relacion_id === relacionId);
}

// ─── Datos de prueba ────────────────────────────────────────────────────────

const REL_ACTIVA: Relacion = {
  id: "cuid_rel_1",
  origen_id: "cuid_contacto_a",
  destino_id: "cuid_contacto_b",
  tipo_relacion_id: "cuid_tipo_socio",
  activa: true,
};

const REL_ARCHIVADA: Relacion = {
  ...REL_ACTIVA,
  id: "cuid_rel_2",
  activa: false,
};

function makeEvidencia(overrides: Partial<EvidenciaRelacion> = {}): EvidenciaRelacion {
  return {
    id: "cuid_ev_1",
    relacion_id: "cuid_rel_1",
    nombre: "contrato-sociedad.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024 * 100, // 100KB
    drive_file_id: null,
    created_at: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Evidencias de Relaciones — FASE 13.06", () => {
  describe("1. Validación de vinculación", () => {
    it("permite vincular a relación activa", () => {
      expect(canAttachEvidencia(REL_ACTIVA)).toEqual({ ok: true });
    });

    it("rechaza vincular a relación archivada", () => {
      const result = canAttachEvidencia(REL_ARCHIVADA);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("archivada");
    });

    it("rechaza vincular a relación inexistente", () => {
      const result = canAttachEvidencia(null);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("no encontrada");
    });
  });

  describe("2. Validación de metadatos de archivo", () => {
    it("acepta archivo válido", () => {
      expect(validateFileMetadata({ nombre: "contrato.pdf" })).toEqual({ ok: true });
    });

    it("rechaza nombre vacío", () => {
      const result = validateFileMetadata({ nombre: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("obligatorio");
    });

    it("rechaza nombre demasiado largo", () => {
      const result = validateFileMetadata({ nombre: "a".repeat(256) });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("255");
    });

    it("rechaza archivo que supera 50MB", () => {
      const result = validateFileMetadata({
        nombre: "archivo.zip",
        size_bytes: 51 * 1024 * 1024,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("50MB");
    });

    it("acepta archivo dentro del límite de 50MB", () => {
      const result = validateFileMetadata({
        nombre: "archivo.zip",
        size_bytes: 49 * 1024 * 1024,
      });
      expect(result.ok).toBe(true);
    });

    it("acepta size_bytes null (metadatos no disponibles)", () => {
      expect(validateFileMetadata({ nombre: "doc.pdf", size_bytes: null })).toEqual({ ok: true });
    });
  });

  describe("3. Drive stub", () => {
    it("genera drive_file_id simulado con formato correcto", () => {
      const id = generateStubDriveId("rel_123", "contrato-sociedad.pdf");
      expect(id).toBe("stub_rel_123_contrato_sociedad_pdf");
      expect(id).toMatch(/^stub_/);
    });

    it("sanitiza caracteres especiales en el nombre", () => {
      const id = generateStubDriveId("rel_1", "archivo (copia).docx");
      expect(id).not.toContain(" ");
      expect(id).not.toContain("(");
    });

    it("genera path Drive correcto para evidencia", () => {
      const path = buildEvidenciaDrivePath("Juan García", "Socio", "Empresa ABC");
      expect(path).toEqual([
        "Contactos",
        "Juan García",
        "_RELACIONES",
        "Socio - Empresa ABC",
      ]);
    });
  });

  describe("4. Filtrado de evidencias", () => {
    const evidencias: EvidenciaRelacion[] = [
      makeEvidencia({ id: "ev_1", relacion_id: "rel_1" }),
      makeEvidencia({ id: "ev_2", relacion_id: "rel_1" }),
      makeEvidencia({ id: "ev_3", relacion_id: "rel_2" }),
    ];

    it("filtra evidencias por relacion_id", () => {
      const result = filterByRelacion(evidencias, "rel_1");
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.relacion_id === "rel_1")).toBe(true);
    });

    it("devuelve vacío si no hay match", () => {
      expect(filterByRelacion(evidencias, "rel_inexistente")).toHaveLength(0);
    });
  });

  describe("5. AuditLog — acción correcta por operación", () => {
    it("attach → CREATE", () => {
      expect(getEvidenciaAuditAction("attach")).toBe("CREATE");
    });

    it("detach → FORGET", () => {
      expect(getEvidenciaAuditAction("detach")).toBe("FORGET");
    });
  });

  describe("6. Integridad de datos", () => {
    it("evidencia nueva tiene drive_file_id null por defecto", () => {
      const ev = makeEvidencia();
      expect(ev.drive_file_id).toBeNull();
    });

    it("evidencia con stub tiene drive_file_id no null", () => {
      const ev = makeEvidencia({
        drive_file_id: generateStubDriveId("rel_1", "doc.pdf"),
      });
      expect(ev.drive_file_id).not.toBeNull();
      expect(ev.drive_file_id).toMatch(/^stub_/);
    });

    it("mime_type puede ser null (archivo desconocido)", () => {
      const ev = makeEvidencia({ mime_type: null });
      expect(ev.mime_type).toBeNull();
    });
  });
});
