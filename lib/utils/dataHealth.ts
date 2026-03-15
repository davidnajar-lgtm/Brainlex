// ============================================================================
// dataHealth.ts — Indicador de completitud de la ficha de Contacto
//
// Algoritmo de puntuación (100 pts máx):
//   fiscal_id           20 pts — identificación legal imprescindible
//   nombre/razon_social 20 pts — identidad presentable
//   telefono_movil      20 pts — canal de contacto principal
//   email_principal     20 pts — canal digital principal
//   cnae                10 pts — clasificación económica
//   iae                 10 pts — epígrafe fiscal
//
// El resultado es un entero 0–100 que se renderiza como indicador circular.
// Es una función pura sin dependencias externas (apta para RSC y cliente).
// ============================================================================

type ContactoHealthFields = {
  fiscal_id?: string | null;
  nombre?: string | null;
  apellido1?: string | null;
  razon_social?: string | null;
  telefono_movil?: string | null;
  email_principal?: string | null;
  cnae?: string | null;
  iae?: string | null;
};

export function calcDataHealth(c: ContactoHealthFields): number {
  let score = 0;

  if (c.fiscal_id?.trim()) score += 20;

  // Persona Física: nombre (o al menos apellido1). Persona Jurídica: razon_social
  const hasIdentidad =
    (c.nombre?.trim() || c.apellido1?.trim() || c.razon_social?.trim()) != null &&
    (c.nombre?.trim() || c.apellido1?.trim() || c.razon_social?.trim()) !== "";
  if (hasIdentidad) score += 20;

  if (c.telefono_movil?.trim()) score += 20;
  if (c.email_principal?.trim()) score += 20;
  if (c.cnae?.trim()) score += 10;
  if (c.iae?.trim()) score += 10;

  return score;
}

/** Devuelve el color semáforo según la puntuación. */
export function dataHealthColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green-500
  if (score >= 50) return "#f59e0b"; // amber-500
  return "#ef4444";                   // red-500
}

/** Devuelve lista legible de campos que faltan por completar. */
export function getMissingFields(c: ContactoHealthFields): string[] {
  const missing: string[] = [];
  if (!c.fiscal_id?.trim())        missing.push("NIF / CIF");

  const hasIdentidad =
    (c.nombre?.trim() || c.apellido1?.trim() || c.razon_social?.trim()) != null &&
    (c.nombre?.trim() || c.apellido1?.trim() || c.razon_social?.trim()) !== "";
  if (!hasIdentidad)               missing.push("Nombre / Razón Social");

  if (!c.telefono_movil?.trim())   missing.push("Teléfono Móvil");
  if (!c.email_principal?.trim())  missing.push("Email");
  if (!c.cnae?.trim())             missing.push("CNAE");
  if (!c.iae?.trim())              missing.push("IAE");
  return missing;
}

/** Indica si un contacto tiene los datos mínimos para facturar (NIF). */
export function isFiscalReady(c: ContactoHealthFields): boolean {
  return !!c.fiscal_id?.trim();
}
