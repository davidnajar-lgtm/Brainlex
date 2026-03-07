// ============================================================================
// agents/performance/Optimizer.ts — Agente de Rendimiento: Presupuesto de Carga
//
// @role:   Agente de Rendimiento (Performance Agent)
// @author: Arquitecto Jefe (Sistema de Alta Disponibilidad)
//
// RESPONSABILIDAD:
//   Auditar los tiempos de respuesta de APIs y el peso de los componentes
//   de Frontend. Emitir VETO sobre cualquier implementación que degrade
//   la experiencia de usuario por latencia.
//
// REGLAS DE VETO (poder sobre @Frontend-UX y @Data-Architect):
//
//   VETO 1 — PRESUPUESTO DE CARGA:
//     Ninguna página puede superar los 200ms de TTI (Time to Interactive).
//     Si una implementación lo supera → VETO con código PERF_BUDGET_EXCEEDED.
//
//   VETO 2 — PAGINACIÓN OBLIGATORIA:
//     El Agente de Datos DEBE usar paginación + cursor-based fetch.
//     Prohibido cargar listas completas de Contactos (o cualquier entidad).
//     El tamaño de página máximo es MAX_PAGE_SIZE = 50 registros.
//
//   VETO 3 — GOOGLE MAPS LAZY:
//     La API de Google Maps SOLO puede cargarse mediante dynamic import
//     en los componentes que la usan estrictamente. NUNCA en el bundle
//     principal ni en el layout raíz. La carga global penaliza el LCP
//     en todas las páginas que no usan Maps.
//
//   VETO 4 — EFECTO ÁRBOL DE NAVIDAD:
//     Ninguna página puede tener animaciones o gráficos que bajen el
//     scroll a menos de 60fps. El Agente de Frontend recibe VETO si
//     añade componentes pesados (p.ej. charts con D3) sin lazy loading.
//
//   VETO 5 — CACHÉ DE CLIENTE (SWR):
//     Los datos de entidades ya visitadas DEBEN estar en caché SWR.
//     Al volver a un contacto visitado, debe renderizarse desde caché
//     sin consultar de nuevo la BD. staleTime mínimo recomendado: 60s.
//
// CERTIFICADO DE MÓDULO:
//   Versión: 1.0.0 | Fecha: 2026-03-07 | Aprobado: Arquitecto Jefe
// ============================================================================

// ─── Constantes de Presupuesto ────────────────────────────────────────────────

/** TTI máximo permitido por página en milisegundos. */
export const LOAD_BUDGET_MS = 200;

/** Tamaño máximo de página en consultas de lista. */
export const MAX_PAGE_SIZE = 50;

/** TTL de caché en cliente para entidades individuales (segundos). */
export const CLIENT_CACHE_TTL_SECONDS = 60;

/** TTL de caché en cliente para listas paginadas (segundos). */
export const LIST_CACHE_TTL_SECONDS = 30;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type PerformanceVerdict = "APPROVED" | "VETOED";

export interface PerformanceCertificate {
  module: string;
  verdict: PerformanceVerdict;
  timestamp: string;
  budget_ms: number;
  checks: PerformanceCheck[];
}

export interface PerformanceCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface PaginationOptions {
  cursor?: string;
  pageSize: number;
  direction?: "forward" | "backward";
}

// ─── Error de veto de rendimiento ────────────────────────────────────────────

export class PerformanceVetoError extends Error {
  readonly code = "PERF_VETO" as const;

  constructor(
    message: string,
    public readonly rule: string,
    public readonly measuredMs?: number
  ) {
    super(message);
    this.name = "PerformanceVetoError";
    Object.setPrototypeOf(this, PerformanceVetoError.prototype);
  }
}

// ─── Optimizer ───────────────────────────────────────────────────────────────

export const Optimizer = {
  // ───────────────────────────────────────────────────────────────────────────
  // VETO 1 — Presupuesto de Carga
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Verifica que una operación medida cumpla el presupuesto de TTI.
   * Lanza PerformanceVetoError si supera LOAD_BUDGET_MS.
   *
   * NOTA: Para uso en pruebas de rendimiento y auditorías manuales.
   * En producción, usar `measureAsync` para wrappear operaciones críticas.
   */
  assertBudget(measuredMs: number, context: string): void {
    if (measuredMs > LOAD_BUDGET_MS) {
      throw new PerformanceVetoError(
        `[AGENTE RENDIMIENTO VETO] "${context}" tardó ${measuredMs}ms ` +
          `(presupuesto: ${LOAD_BUDGET_MS}ms). ` +
          `Refactoriza con paginación, índices o caché antes de pasar a producción.`,
        "LOAD_BUDGET",
        measuredMs
      );
    }
  },

  /**
   * Wrappea una función async y mide su tiempo de ejecución.
   * Registra en consola si supera el presupuesto (no lanza en producción).
   */
  async measureAsync<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const elapsed = Date.now() - start;

    if (elapsed > LOAD_BUDGET_MS) {
      console.warn(
        `[OPTIMIZER WARN] "${context}" superó el presupuesto: ${elapsed}ms > ${LOAD_BUDGET_MS}ms`
      );
    }

    return result;
  },

  // ───────────────────────────────────────────────────────────────────────────
  // VETO 2 — Paginación Obligatoria
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Valida los parámetros de paginación y fuerza el límite máximo.
   * Lanza PerformanceVetoError si se solicitan más de MAX_PAGE_SIZE registros.
   *
   * OBLIGATORIO: llamar en todo repository que devuelva listas de entidades.
   */
  enforcePagination(options: PaginationOptions): PaginationOptions {
    if (options.pageSize > MAX_PAGE_SIZE) {
      throw new PerformanceVetoError(
        `[AGENTE RENDIMIENTO VETO] Se solicitaron ${options.pageSize} registros por página. ` +
          `El máximo permitido es ${MAX_PAGE_SIZE}. ` +
          `Usa cursor-based pagination para navegar entre páginas.`,
        "PAGINATION",
      );
    }

    if (options.pageSize <= 0) {
      throw new PerformanceVetoError(
        `[AGENTE RENDIMIENTO VETO] pageSize debe ser > 0.`,
        "PAGINATION"
      );
    }

    return {
      cursor:    options.cursor,
      pageSize:  Math.min(options.pageSize, MAX_PAGE_SIZE),
      direction: options.direction ?? "forward",
    };
  },

  /**
   * Genera el bloque `take/skip/cursor` de Prisma para paginación cursor-based.
   * Compatible con los repositorios de Prisma del proyecto.
   *
   * USO:
   *   const { take, cursor, skip } = Optimizer.buildPrismaPage({ pageSize: 20, cursor: lastId });
   */
  buildPrismaPage(options: PaginationOptions): {
    take: number;
    skip?: number;
    cursor?: { id: string };
  } {
    const validated = this.enforcePagination(options);

    return {
      take:   validated.direction === "backward" ? -validated.pageSize : validated.pageSize,
      cursor: validated.cursor ? { id: validated.cursor } : undefined,
      skip:   validated.cursor ? 1 : undefined,
    };
  },

  // ───────────────────────────────────────────────────────────────────────────
  // VETO 3 — Google Maps Lazy
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Valida en tiempo de análisis que Google Maps se carga dinámicamente.
   * REGLA: el import de Maps debe ser `dynamic(() => import(...), { ssr: false })`.
   * No debe aparecer en ningún layout, _app o componente raíz.
   *
   * Este método documenta la regla; la verificación real se aplica en code-review.
   */
  assertGoogleMapsLazy(componentPath: string): void {
    const FORBIDDEN_PATHS = [
      "app/layout.tsx",
      "app/[locale]/layout.tsx",
      "components/layout",
    ];

    const isForbidden = FORBIDDEN_PATHS.some((p) => componentPath.includes(p));

    if (isForbidden) {
      throw new PerformanceVetoError(
        `[AGENTE RENDIMIENTO VETO] Google Maps NO puede cargarse en "${componentPath}". ` +
          `Usa next/dynamic con ssr:false SOLO en el componente que lo necesita ` +
          `(p.ej. PlacesAutocompleteInput o DireccionFormModal). ` +
          `La carga global penaliza el LCP de TODAS las páginas.`,
        "GOOGLE_MAPS_LAZY"
      );
    }
  },

  // ───────────────────────────────────────────────────────────────────────────
  // VETO 5 — Caché de Cliente (SWR)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve la configuración recomendada de SWR para entidades de Contacto.
   * Asegura que los datos visitados se sirvan desde caché sin re-fetch.
   *
   * INTEGRACIÓN: pasar al hook `useSWR(key, fetcher, swrConfig)`.
   */
  getContactoSWRConfig() {
    return {
      revalidateOnFocus:        false,
      revalidateOnReconnect:    true,
      dedupingInterval:         CLIENT_CACHE_TTL_SECONDS * 1000,
      focusThrottleInterval:    CLIENT_CACHE_TTL_SECONDS * 1000,
      /**
       * keepPreviousData=true garantiza que al paginar o cambiar de contacto
       * el contenido anterior se muestra hasta que llegan los nuevos datos.
       * Evita parpadeos y mejora la percepción de velocidad.
       */
      keepPreviousData:         true,
    } as const;
  },

  /**
   * Devuelve la configuración recomendada de SWR para listas paginadas.
   */
  getListSWRConfig() {
    return {
      revalidateOnFocus:     false,
      revalidateOnReconnect: true,
      dedupingInterval:      LIST_CACHE_TTL_SECONDS * 1000,
      keepPreviousData:      true,
    } as const;
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Certificado de Cumplimiento de Módulo
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Emite el certificado de rendimiento de un módulo antes de pasar a producción.
   * Todos los checks deben ser `passed: true` para obtener veredicto "APPROVED".
   *
   * OBLIGATORIO: llamar antes del merge a main de cualquier módulo de lista
   * o formulario con mapas.
   */
  issueCertificate(
    module: string,
    checks: PerformanceCheck[]
  ): PerformanceCertificate {
    const allPassed = checks.every((c) => c.passed);

    if (!allPassed) {
      const failed = checks.filter((c) => !c.passed).map((c) => c.rule);
      console.error(
        `[OPTIMIZER CERTIFICATE REJECTED] Módulo "${module}" — checks fallidos: ${failed.join(", ")}`
      );
    }

    return {
      module,
      verdict:   allPassed ? "APPROVED" : "VETOED",
      timestamp: new Date().toISOString(),
      budget_ms: LOAD_BUDGET_MS,
      checks,
    };
  },

  /**
   * Genera los checks estándar de rendimiento para un módulo de lista.
   * Rellena los valores según el análisis del implementador.
   */
  buildStandardChecks(opts: {
    usesPagination:       boolean;
    usesSWRCache:         boolean;
    googleMapsIsLazy:     boolean;
    noGlobalAnimations:   boolean;
    estimatedTTIms:       number;
  }): PerformanceCheck[] {
    return [
      {
        rule:   "PAGINATION",
        passed: opts.usesPagination,
        detail: opts.usesPagination
          ? `Paginación cursor-based implementada (máx. ${MAX_PAGE_SIZE} registros/página).`
          : "FALLO: La lista carga todos los registros sin paginar.",
      },
      {
        rule:   "SWR_CACHE",
        passed: opts.usesSWRCache,
        detail: opts.usesSWRCache
          ? `Caché SWR activa (TTL individual: ${CLIENT_CACHE_TTL_SECONDS}s, listas: ${LIST_CACHE_TTL_SECONDS}s).`
          : "FALLO: No hay caché de cliente. Los datos se re-piden en cada visita.",
      },
      {
        rule:   "GOOGLE_MAPS_LAZY",
        passed: opts.googleMapsIsLazy,
        detail: opts.googleMapsIsLazy
          ? "Google Maps cargado con next/dynamic + ssr:false solo donde se necesita."
          : "FALLO: Google Maps se carga de forma global o en el layout.",
      },
      {
        rule:   "NO_JANK_ANIMATIONS",
        passed: opts.noGlobalAnimations,
        detail: opts.noGlobalAnimations
          ? "Sin animaciones pesadas en el scroll principal."
          : "FALLO: Animaciones o gráficos detectados sin lazy loading — riesgo de jank.",
      },
      {
        rule:   "LOAD_BUDGET",
        passed: opts.estimatedTTIms <= LOAD_BUDGET_MS,
        detail: `TTI estimado: ${opts.estimatedTTIms}ms (presupuesto: ${LOAD_BUDGET_MS}ms). ` +
          (opts.estimatedTTIms <= LOAD_BUDGET_MS ? "DENTRO del presupuesto." : "EXCEDE el presupuesto."),
      },
    ];
  },
} as const;
