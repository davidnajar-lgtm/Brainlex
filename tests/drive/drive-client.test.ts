// ============================================================================
// tests/drive/drive-client.test.ts — Tests del DriveClient
//
// Verifica la lógica pura del cliente de Drive: detección de credenciales,
// exponential backoff, y sanitización de nombres de carpeta.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Lógica pura extraída para testing ───────────────────────────────────────

/** Detecta si las credenciales de Drive están configuradas en el entorno. */
function isDriveConfigured(env: Record<string, string | undefined>): boolean {
  return !!(
    env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim() &&
    env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()
  );
}

/** Sanitiza nombre de carpeta para Google Drive (sin caracteres prohibidos). */
function sanitizeFolderName(name: string): string {
  return name.trim().replace(/[/\\:*?"<>|]/g, "_");
}

/** Calcula delay para exponential backoff con jitter. */
function calculateBackoff(attempt: number, baseMs = 1000, maxMs = 32000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = exponential * (0.5 + Math.random() * 0.5);
  return Math.round(jitter);
}

/** Determina si un error HTTP es retryable (429 o 5xx). */
function isRetryableError(statusCode: number): boolean {
  return statusCode === 429 || statusCode === 403 || (statusCode >= 500 && statusCode < 600);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("isDriveConfigured — Detección de credenciales", () => {
  it("retorna true cuando ambas variables están presentes", () => {
    expect(isDriveConfigured({
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "abc123",
    })).toBe(true);
  });

  it("retorna false si falta SERVICE_ACCOUNT_JSON", () => {
    expect(isDriveConfigured({
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: undefined,
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "abc123",
    })).toBe(false);
  });

  it("retorna false si falta ROOT_FOLDER_ID", () => {
    expect(isDriveConfigured({
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
      GOOGLE_DRIVE_ROOT_FOLDER_ID: undefined,
    })).toBe(false);
  });

  it("retorna false si SERVICE_ACCOUNT_JSON está vacío", () => {
    expect(isDriveConfigured({
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: "  ",
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "abc123",
    })).toBe(false);
  });

  it("retorna false si ROOT_FOLDER_ID está vacío", () => {
    expect(isDriveConfigured({
      GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "   ",
    })).toBe(false);
  });

  it("retorna false si ambas están ausentes", () => {
    expect(isDriveConfigured({})).toBe(false);
  });
});

describe("sanitizeFolderName — Sanitización de nombres", () => {
  it("mantiene nombres válidos intactos", () => {
    expect(sanitizeFolderName("Expediente 2026")).toBe("Expediente 2026");
  });

  it("reemplaza barras y caracteres prohibidos", () => {
    expect(sanitizeFolderName("Informe/Final")).toBe("Informe_Final");
    expect(sanitizeFolderName("Doc:v2")).toBe("Doc_v2");
    expect(sanitizeFolderName("Test<>File")).toBe("Test__File");
  });

  it("elimina espacios al inicio y final", () => {
    expect(sanitizeFolderName("  Carpeta  ")).toBe("Carpeta");
  });
});

describe("calculateBackoff — Exponential Backoff", () => {
  it("primer intento: delay entre 500ms y 1000ms (base 1s)", () => {
    // attempt=0 → base * 2^0 = 1000ms, jitter [500, 1000]
    const delays = Array.from({ length: 100 }, () => calculateBackoff(0, 1000));
    expect(delays.every((d) => d >= 500 && d <= 1000)).toBe(true);
  });

  it("segundo intento: delay entre 1000ms y 2000ms", () => {
    const delays = Array.from({ length: 100 }, () => calculateBackoff(1, 1000));
    expect(delays.every((d) => d >= 1000 && d <= 2000)).toBe(true);
  });

  it("nunca excede maxMs", () => {
    const delays = Array.from({ length: 100 }, () => calculateBackoff(10, 1000, 32000));
    expect(delays.every((d) => d <= 32000)).toBe(true);
  });
});

describe("isRetryableError — Errores retryable", () => {
  it("429 (Too Many Requests) es retryable", () => {
    expect(isRetryableError(429)).toBe(true);
  });

  it("403 (Rate Limit Exceeded) es retryable", () => {
    expect(isRetryableError(403)).toBe(true);
  });

  it("500 (Internal Server Error) es retryable", () => {
    expect(isRetryableError(500)).toBe(true);
  });

  it("503 (Service Unavailable) es retryable", () => {
    expect(isRetryableError(503)).toBe(true);
  });

  it("400 (Bad Request) NO es retryable", () => {
    expect(isRetryableError(400)).toBe(false);
  });

  it("404 (Not Found) NO es retryable", () => {
    expect(isRetryableError(404)).toBe(false);
  });

  it("401 (Unauthorized) NO es retryable", () => {
    expect(isRetryableError(401)).toBe(false);
  });
});
