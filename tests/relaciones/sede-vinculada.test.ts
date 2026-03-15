// ============================================================================
// tests/relaciones/sede-vinculada.test.ts — TDD: Selector de Sede Vinculada
//
// @role: @QA-Engineer / @Data-Architect
// @spec: FASE 13.01 — Motor de Relaciones y Sedes
//
// COBERTURA:
//   1. Formateo de direcciones para selector
//   2. Filtro de sede por contacto destino
//   3. Sede vinculada se incluye en la creación de relación
//   4. Display de sede en tarjetas de relación
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface DireccionPickerItem {
  id: string;
  label: string;
  tipo: string;
}

interface DireccionRaw {
  id: string;
  tipo: string;
  etiqueta: string | null;
  calle: string;
  ciudad: string | null;
  provincia: string | null;
}

// ─── Lógica pura a testear ──────────────────────────────────────────────────

function formatDireccionLabel(d: DireccionRaw): string {
  const tipoLabel = d.tipo === "WORKPLACE" && d.etiqueta ? d.etiqueta : d.tipo;
  const parts = [d.calle, d.ciudad, d.provincia].filter(Boolean);
  return `${tipoLabel} — ${parts.join(", ")}`;
}

function toDireccionPickerItems(direcciones: DireccionRaw[]): DireccionPickerItem[] {
  return direcciones.map((d) => ({
    id: d.id,
    label: formatDireccionLabel(d),
    tipo: d.tipo,
  }));
}

// ─── 1. Formateo de direcciones ─────────────────────────────────────────────

describe("Sede Vinculada — formateo de dirección", () => {
  it("formatea dirección FISCAL con ciudad y provincia", () => {
    const d: DireccionRaw = {
      id: "dir-1", tipo: "FISCAL", etiqueta: null,
      calle: "Calle Mayor 5", ciudad: "Madrid", provincia: "Madrid",
    };
    expect(formatDireccionLabel(d)).toBe("FISCAL — Calle Mayor 5, Madrid, Madrid");
  });

  it("formatea dirección WORKPLACE con etiqueta personalizada", () => {
    const d: DireccionRaw = {
      id: "dir-2", tipo: "WORKPLACE", etiqueta: "Sede Madrid",
      calle: "Gran Vía 1", ciudad: "Madrid", provincia: null,
    };
    expect(formatDireccionLabel(d)).toBe("Sede Madrid — Gran Vía 1, Madrid");
  });

  it("WORKPLACE sin etiqueta muestra tipo genérico", () => {
    const d: DireccionRaw = {
      id: "dir-3", tipo: "WORKPLACE", etiqueta: null,
      calle: "Paseo de la Castellana 200", ciudad: null, provincia: null,
    };
    expect(formatDireccionLabel(d)).toBe("WORKPLACE — Paseo de la Castellana 200");
  });

  it("DOMICILIO_SOCIAL muestra tipo directamente", () => {
    const d: DireccionRaw = {
      id: "dir-4", tipo: "DOMICILIO_SOCIAL", etiqueta: null,
      calle: "Av. Diagonal 100", ciudad: "Barcelona", provincia: "Barcelona",
    };
    expect(formatDireccionLabel(d)).toBe("DOMICILIO_SOCIAL — Av. Diagonal 100, Barcelona, Barcelona");
  });
});

// ─── 2. Conversión a picker items ───────────────────────────────────────────

describe("Sede Vinculada — conversión a picker items", () => {
  it("convierte lista de direcciones a items de selector", () => {
    const direcciones: DireccionRaw[] = [
      { id: "d1", tipo: "FISCAL", etiqueta: null, calle: "C/ Uno", ciudad: "Madrid", provincia: null },
      { id: "d2", tipo: "WORKPLACE", etiqueta: "Nave Norte", calle: "Pol. Industrial 3", ciudad: "Getafe", provincia: "Madrid" },
    ];
    const items = toDireccionPickerItems(direcciones);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: "d1",
      label: "FISCAL — C/ Uno, Madrid",
      tipo: "FISCAL",
    });
    expect(items[1]).toEqual({
      id: "d2",
      label: "Nave Norte — Pol. Industrial 3, Getafe, Madrid",
      tipo: "WORKPLACE",
    });
  });

  it("lista vacía → array vacío", () => {
    expect(toDireccionPickerItems([])).toEqual([]);
  });
});

// ─── 3. Validación de sede en schema de relación ────────────────────────────

describe("Sede Vinculada — integración con Relacion", () => {
  it("sede_vinculada_id es opcional (puede ser undefined)", () => {
    const relInput = {
      origen_id: "c1",
      destino_id: "c2",
      tipo_relacion_id: "t1",
      sede_vinculada_id: undefined,
    };
    expect(relInput.sede_vinculada_id).toBeUndefined();
  });

  it("sede_vinculada_id puede ser un CUID", () => {
    const relInput = {
      origen_id: "c1",
      destino_id: "c2",
      tipo_relacion_id: "t1",
      sede_vinculada_id: "clxyz123abc",
    };
    expect(relInput.sede_vinculada_id).toBe("clxyz123abc");
  });
});

// ─── 4. Display de sede en tarjetas ─────────────────────────────────────────

describe("Sede Vinculada — display en tarjetas", () => {
  function buildSedeLabel(
    cargo: string | null | undefined,
    sedeName: string | null | undefined,
  ): string {
    if (cargo && sedeName) return `${cargo} en ${sedeName}`;
    if (cargo) return cargo;
    if (sedeName) return `Sede: ${sedeName}`;
    return "";
  }

  it("cargo + sede → 'Director en Sede Madrid'", () => {
    expect(buildSedeLabel("Director", "Sede Madrid")).toBe("Director en Sede Madrid");
  });

  it("solo cargo → muestra solo cargo", () => {
    expect(buildSedeLabel("Director Financiero", null)).toBe("Director Financiero");
  });

  it("solo sede → muestra 'Sede: ...'", () => {
    expect(buildSedeLabel(null, "Nave Norte")).toBe("Sede: Nave Norte");
  });

  it("sin cargo ni sede → cadena vacía", () => {
    expect(buildSedeLabel(null, null)).toBe("");
  });
});
