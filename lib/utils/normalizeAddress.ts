// ============================================================================
// lib/utils/normalizeAddress.ts
//
// @role: Agente de Backend / QA-Engineer
// @spec: Directorio Inteligente — normalización de direcciones pre-commit
//
// Convierte strings de dirección de Google Maps a Title Case inteligente:
//  - Lowercase toda la cadena primero (elimina mayúsculas espurias, ej. "ParíS")
//  - Capitaliza la primera letra de cada palabra
//  - Mantiene en minúscula las preposiciones y artículos (es/ca/fr)
//  - Respeta caracteres especiales: ñ, ç, acentos
//  - Gestiona contracciones con apóstrofo: d'Urgell, L'Hospitalet
// ============================================================================

// Preposiciones y artículos que deben permanecer en minúscula (es/ca/fr)
const LOWERCASE_WORDS = new Set([
  // Español
  "de", "del", "la", "las", "los", "el", "en", "y", "a", "al", "con",
  "por", "para", "sin", "sobre", "entre", "desde", "hasta",
  // Catalán
  "i", "amb", "per", "des", "fins",
  // Francés
  "du", "des", "le", "les", "et", "sur", "au", "aux", "par",
]);

// Prefijos de contracción con apóstrofo que deben ir en minúscula: d'Urgell, l'Hospitalet
const LOWERCASE_APOSTROPHE_PREFIXES = new Set(["d", "l", "qu", "n", "m", "s"]);

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Normaliza una dirección a Title Case inteligente antes de persistirla en BD.
 *
 * Ejemplos:
 *   "Carrer De ParíS, 184"  →  "Carrer de París, 184"
 *   "Roger De LlúRia"       →  "Roger de Llúria"
 *   "AVDA. DE L'HOSPITALET" →  "Avda. de l'Hospitalet"
 */
export function normalizeAddress(input: string): string {
  if (!input || !input.trim()) return input;

  let isFirst = true;

  return input
    .trim()
    .split(/(\s+)/) // divide preservando los espacios como tokens
    .map((token) => {
      // Los tokens de espacio pasan tal cual
      if (/^\s+$/.test(token)) return token;

      const lower = token.toLowerCase();

      // La primera palabra real siempre se capitaliza (independientemente de la lista)
      if (isFirst) {
        isFirst = false;
        return processToken(lower, /* forceCapitalize */ true);
      }

      return processToken(lower, /* forceCapitalize */ false);
    })
    .join("");
}

/**
 * Procesa un token individual.
 * Si contiene apóstrofo (d', l', de l') divide y capitaliza la parte léxica.
 */
function processToken(lower: string, forceCapitalize: boolean): string {
  const aposIdx = lower.indexOf("'");

  if (aposIdx !== -1) {
    const prefix = lower.slice(0, aposIdx);   // e.g. "d", "l", "de l"
    const suffix = lower.slice(aposIdx + 1);  // e.g. "urgell", "hospitalet"

    const prefixIsLower =
      !forceCapitalize &&
      (LOWERCASE_WORDS.has(prefix) ||
        LOWERCASE_APOSTROPHE_PREFIXES.has(prefix) ||
        LOWERCASE_WORDS.has(prefix + "'"));

    const normalizedPrefix = prefixIsLower ? prefix : capitalize(prefix);
    return normalizedPrefix + "'" + capitalize(suffix);
  }

  if (forceCapitalize || !LOWERCASE_WORDS.has(lower)) {
    return capitalize(lower);
  }

  return lower;
}
