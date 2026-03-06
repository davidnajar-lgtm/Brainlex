// ============================================================================
// lib/constants/sociedades.ts — Diccionario Internacional de Tipos de Sociedad
// ============================================================================

export const TIPOS_SOCIEDAD: readonly string[] = [
  // ── España / Iberoamérica ─────────────────────────────────────────────────
  "S.L.",
  "S.L.U.",
  "S.A.",
  "S.A.U.",
  "C.B.",
  "S.Coop.",
  "S.C.P.",
  "Asociación",
  "Fundación",
  "S.A.S.",
  "S.R.L.",
  // ── Anglosajón (UK, USA, Australia, Canadá, etc.) ─────────────────────────
  "LLC",
  "Inc.",
  "Corp.",
  "Ltd.",
  "PLC",
  "LLP",
  "LP",
  // ── Europa Continental ────────────────────────────────────────────────────
  "GmbH",
  "AG",
  "UG",
  "SARL",
  "SA (Francia)",
  "SAS",
  "SpA",
  "Srl",
  "B.V.",
  "N.V.",
  // ── Otras ─────────────────────────────────────────────────────────────────
  "Otra / Extranjera",
] as const;
