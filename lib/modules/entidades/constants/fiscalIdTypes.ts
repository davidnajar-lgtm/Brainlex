// ============================================================================
// lib/modules/entidades/constants/fiscalIdTypes.ts
//
// @role: @Data-Architect
// @spec: Fase 9.1 — Constantes de tipos de ID fiscal por tipo de contacto
//
// Centraliza las opciones de fiscal_id_tipo para PF y PJ.
// Consumido por: IdentityEditModal, /contactos/nuevo (legacy).
// ============================================================================

import { FiscalIdTipo } from "@prisma/client";

export type FiscalIdOption = { value: FiscalIdTipo; label: string };

export const FISCAL_ID_TIPOS_PF: FiscalIdOption[] = [
  { value: FiscalIdTipo.NIF,            label: "NIF" },
  { value: FiscalIdTipo.DNI,            label: "DNI" },
  { value: FiscalIdTipo.NIE,            label: "NIE" },
  { value: FiscalIdTipo.PASAPORTE,      label: "Pasaporte" },
  { value: FiscalIdTipo.TIE,            label: "TIE" },
  { value: FiscalIdTipo.VAT,            label: "VAT (UE)" },
  { value: FiscalIdTipo.K,              label: "NIF K (menor español)" },
  { value: FiscalIdTipo.L,              label: "NIF L (español en extranjero)" },
  { value: FiscalIdTipo.M,              label: "NIF M (extranjero sin NIE)" },
  { value: FiscalIdTipo.CODIGO_SOPORTE, label: "Código de Soporte" },
  { value: FiscalIdTipo.SIN_REGISTRO,   label: "Sin Registro" },
];

export const FISCAL_ID_TIPOS_PJ: FiscalIdOption[] = [
  { value: FiscalIdTipo.NIF,          label: "NIF" },
  { value: FiscalIdTipo.VAT,          label: "VAT (UE)" },
  { value: FiscalIdTipo.SIN_REGISTRO, label: "Sin Registro" },
];
