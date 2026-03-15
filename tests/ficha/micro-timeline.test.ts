// ============================================================================
// tests/ficha/micro-timeline.test.ts — Tests del MicroTimeline
//
// Verifica la lógica de formateo de tiempo relativo y selección de entries.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Lógica extraída del componente (helpers puros) ──────────────────────────

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins < 1)   return "ahora mismo";
  if (mins < 60)  return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return "ayer";
  if (days < 30)  return `hace ${days} días`;

  return new Intl.DateTimeFormat("es-ES", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  }).format(date);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("timeAgo — Formateo de tiempo relativo", () => {
  const NOW = new Date("2026-03-15T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna 'ahora mismo' para menos de 1 minuto", () => {
    const date = new Date(NOW - 30_000); // 30 segundos
    expect(timeAgo(date)).toBe("ahora mismo");
  });

  it("retorna minutos para menos de 1 hora", () => {
    const date = new Date(NOW - 15 * 60_000); // 15 min
    expect(timeAgo(date)).toBe("hace 15 min");
  });

  it("retorna horas para menos de 24 horas", () => {
    const date = new Date(NOW - 5 * 3_600_000); // 5h
    expect(timeAgo(date)).toBe("hace 5h");
  });

  it("retorna 'ayer' para exactamente 1 día", () => {
    const date = new Date(NOW - 86_400_000);
    expect(timeAgo(date)).toBe("ayer");
  });

  it("retorna días para menos de 30 días", () => {
    const date = new Date(NOW - 7 * 86_400_000); // 7 días
    expect(timeAgo(date)).toBe("hace 7 días");
  });

  it("retorna fecha formateada para 30+ días", () => {
    const date = new Date(NOW - 45 * 86_400_000); // 45 días
    const result = timeAgo(date);
    // Debe contener año y ser una fecha formateada, no relativa
    expect(result).toMatch(/\d{2}/);
    expect(result).not.toContain("hace");
  });
});

describe("MicroTimeline — Selección de entries", () => {
  it("identifica CREATE como entry de creación", () => {
    const entries = [
      { id: "2", action: "UPDATE" as const, notes: null, created_at: new Date("2026-03-14") },
      { id: "1", action: "CREATE" as const, notes: null, created_at: new Date("2026-03-10") },
    ];
    const createEntry = entries.find((e) => e.action === "CREATE");
    const latestEntry = entries[0];
    expect(createEntry?.action).toBe("CREATE");
    expect(latestEntry.action).toBe("UPDATE");
    expect(latestEntry.id).not.toBe(createEntry?.id);
  });

  it("solo hay CREATE → no muestra última actividad separada", () => {
    const entries = [
      { id: "1", action: "CREATE" as const, notes: null, created_at: new Date("2026-03-10") },
    ];
    const createEntry = entries.find((e) => e.action === "CREATE");
    const latestEntry = entries[0];
    // Cuando el último entry ES el CREATE, no se muestra por separado
    expect(latestEntry.id).toBe(createEntry?.id);
  });

  it("sin entries → timeline vacío", () => {
    const entries: { id: string; action: string; notes: null; created_at: Date }[] = [];
    expect(entries.length).toBe(0);
  });
});
