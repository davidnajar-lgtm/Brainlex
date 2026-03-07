// ============================================================================
// lib/utils/normalizeAddress.test.ts
//
// @role: Agente QA-Engineer
// @spec: Tests unitarios para normalizeAddress (Vitest)
// ============================================================================

import { describe, it, expect } from "vitest";
import { normalizeAddress } from "./normalizeAddress";

describe("normalizeAddress", () => {
  // ── Casos de validación del ticket ────────────────────────────────────────

  it('corrige mayúsculas espurias y preposición: "Carrer De ParíS, 184"', () => {
    expect(normalizeAddress("Carrer De ParíS, 184")).toBe("Carrer de París, 184");
  });

  it('corrige mayúsculas espurias y preposición: "Roger De LlúRia"', () => {
    expect(normalizeAddress("Roger De LlúRia")).toBe("Roger de Llúria");
  });

  // ── Preposiciones / artículos en español ──────────────────────────────────

  it("mantiene 'de' en minúsculas (es)", () => {
    expect(normalizeAddress("CALLE DE LA PAZ")).toBe("Calle de la Paz");
  });

  it("mantiene 'del' en minúsculas (es)", () => {
    expect(normalizeAddress("PASEO DEL PRADO")).toBe("Paseo del Prado");
  });

  it("mantiene 'de los' en minúsculas (es)", () => {
    expect(normalizeAddress("CALLE DE LOS OLIVOS")).toBe("Calle de los Olivos");
  });

  // ── Preposiciones catalanas ────────────────────────────────────────────────

  it("mantiene 'i' en minúsculas (ca) — Gran Via i Consell de Cent", () => {
    expect(normalizeAddress("GRAN VIA I CONSELL DE CENT")).toBe(
      "Gran Via i Consell de Cent",
    );
  });

  // ── Contracciones con apóstrofo (catalán / francés) ──────────────────────

  it("capitaliza el sustantivo tras d' (ca)", () => {
    expect(normalizeAddress("CARRER D'URGELL")).toBe("Carrer d'Urgell");
  });

  it("capitaliza el sustantivo tras L' incluso en uppercase (ca)", () => {
    expect(normalizeAddress("AVINGUDA DE L'HOSPITALET")).toBe(
      "Avinguda de l'Hospitalet",
    );
  });

  // ── Números y caracteres especiales ──────────────────────────────────────

  it("no altera números ni comas", () => {
    expect(normalizeAddress("Carrer de París, 184")).toBe("Carrer de París, 184");
  });

  it("preserva ñ en minúscula/mayúscula", () => {
    expect(normalizeAddress("CALLE DE LA PEÑA")).toBe("Calle de la Peña");
  });

  it("preserva ç (catalán)", () => {
    expect(normalizeAddress("PLAÇA DE CATALUNYA")).toBe("Plaça de Catalunya");
  });

  // ── La primera palabra siempre se capitaliza ──────────────────────────────

  it("capitaliza la primera palabra aunque sea preposición (poco probable)", () => {
    expect(normalizeAddress("de la rosa")).toBe("De la Rosa");
  });

  // ── Casos extremos ────────────────────────────────────────────────────────

  it("devuelve string vacío sin error", () => {
    expect(normalizeAddress("")).toBe("");
  });

  it("devuelve string con solo espacios sin error", () => {
    expect(normalizeAddress("   ")).toBe("   ");
  });

  it("maneja una sola palabra", () => {
    expect(normalizeAddress("MADRID")).toBe("Madrid");
  });

  it("elimina mayúsculas espurias internas (ParíS → París)", () => {
    expect(normalizeAddress("ParíS")).toBe("París");
  });
});
