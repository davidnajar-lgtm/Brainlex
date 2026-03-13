// ============================================================================
// lib/services/securityFilter.service.ts — Filtrado de Seguridad por Rol
//
// @role: @Security-CISO
// @spec: Fase 8.11/8.12 — Restricción de Departamentos y Servicios
//
// RESPONSABILIDAD:
//   Determinar si una etiqueta (Departamento/Servicio) es visible para un
//   usuario según su rol. Las etiquetas marcadas como solo_super_admin=true
//   son INVISIBLES para Staff en:
//     - Visor de Drive (File Explorer)
//     - Clonación de estructura
//     - Listado de etiquetas en el panel de clasificación
//
// REGLA DE ORO:
//   "Si el usuario no es SuperAdmin, la etiqueta restringida NO EXISTE."
//   No se oculta, no se oscurece — simplemente no se incluye en la query.
//
// HERENCIA (8.12):
//   Si un Departamento es restringido, TODOS sus Servicios hijos son
//   invisibles aunque no estén marcados individualmente.
// ============================================================================

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "STAFF";

export interface UserSecurityContext {
  userId: string;
  role:   UserRole;
}

/** Mínimo necesario para evaluar restricción. */
interface RestrictableEntity {
  solo_super_admin?: boolean | null;
}

/** Constructor con flag de restricción para filtrado en Drive/clonación. */
export interface SecuredConstructor {
  categoriaNombre:  string;
  etiquetaNombre:   string;
  solo_super_admin: boolean;
  blueprint?:       string[] | null;
}

// ─── Helpers de detección ───────────────────────────────────────────────────

/**
 * Determina si una entidad es restringida para un usuario concreto.
 *
 * Regla: solo_super_admin=true → restringida para STAFF y ADMIN.
 *        SUPER_ADMIN siempre ve todo.
 */
export function isRestrictedForUser(
  entity: RestrictableEntity,
  user: UserSecurityContext
): boolean {
  if (user.role === "SUPER_ADMIN") return false;
  return entity.solo_super_admin === true;
}

// ─── Filtrado simple (sin herencia) ─────────────────────────────────────────

/**
 * Filtra una lista de constructores (Departamento/Servicio) según el rol.
 * NO aplica herencia padre→hijo. Para herencia, usar filterConstructorsWithInheritance.
 *
 * - SUPER_ADMIN: ve todo, sin filtro.
 * - Cualquier otro rol: excluye etiquetas con solo_super_admin=true.
 */
export function filterConstructorsForRole<
  T extends { solo_super_admin?: boolean | null }
>(
  constructors: T[],
  user: UserSecurityContext
): T[] {
  if (user.role === "SUPER_ADMIN") return constructors;
  return constructors.filter((c) => c.solo_super_admin !== true);
}

// ─── Filtrado con herencia padre→hijo (8.12) ───────────────────────────────

/** Tipo mínimo para constructor con jerarquía. */
interface InheritableConstructor {
  categoriaNombre:   string;
  etiquetaNombre:    string;
  etiquetaId?:       string;
  parentId?:         string | null;
  solo_super_admin:  boolean;
  blueprint?:        string[] | null;
}

/**
 * @Security-CISO — Filtrado con herencia de confidencialidad.
 *
 * Reglas (para no-SuperAdmin):
 *   A) EXCLUSIÓN DIRECTA: si la etiqueta tiene solo_super_admin=true → invisible.
 *   B) HERENCIA: si el Servicio tiene un parentId que apunta a un Departamento
 *      con solo_super_admin=true → el Servicio es invisible aunque no esté
 *      marcado individualmente.
 *
 * SuperAdmin: ve todo sin filtro (bypass total).
 *
 * Uso: SIEMPRE usar esta función (no filterConstructorsForRole) cuando la lista
 * contenga mezcla de Departamentos y Servicios con jerarquía.
 */
export function filterConstructorsWithInheritance<
  T extends InheritableConstructor
>(
  constructors: T[],
  user: UserSecurityContext
): T[] {
  if (user.role === "SUPER_ADMIN") return constructors;

  // 1. Identificar IDs de departamentos restringidos
  const restrictedDeptIds = new Set<string>();
  for (const c of constructors) {
    if (c.categoriaNombre === "Departamento" && c.solo_super_admin === true) {
      const id = c.etiquetaId ?? c.etiquetaNombre; // fallback a nombre si no hay ID
      restrictedDeptIds.add(id);
    }
  }

  // 2. Filtrar: excluir por exclusión directa O por herencia
  return constructors.filter((c) => {
    // A) Exclusión directa
    if (c.solo_super_admin === true) return false;

    // B) Herencia: servicio hijo de departamento restringido
    if (c.categoriaNombre === "Servicio" && c.parentId && restrictedDeptIds.has(c.parentId)) {
      return false;
    }

    return true;
  });
}
