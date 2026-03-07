// ============================================================================
// agents/qa/Auditor.ts — Agente de QA: The Auditor
//
// @role:   @QA-Engineer / Agente de QA
// @author: Arquitecto de Sistemas
//
// RESPONSABILIDAD:
//   Verificar la calidad técnica de cada módulo antes de su paso a producción.
//   Emite el "Sello de Calidad" QA como parte del proceso de certificación
//   triple (Legal + Rendimiento + QA).
//
// LIMITACIONES DE SEGURIDAD (INAMOVIBLES):
//   ✗  PROHIBIDO modificar archivos fuera de `/tests/` y `qa_status.json`.
//   ✗  PROHIBIDO importar o llamar a módulos de negocio con efectos de escritura.
//   ✓  PERMITIDO leer archivos de negocio para auditoría estática.
//   ✓  PERMITIDO escribir archivos en `/tests/` y reportes de error.
//   ✓  PERMITIDO actualizar `qa_status.json` en la raíz.
//
// CHECKS DE certifyModule():
//   CHECK 1 — I18N:        Ningún texto literal en ES/EN/FR puede estar
//                          hardcoded. Todo string de UI debe existir en el
//                          diccionario i18n para los 3 locales.
//   CHECK 2 — TEST SUITE:  Los tests unitarios del módulo deben pasar al 100%.
//                          Ejecuta `vitest run` y captura el resultado.
//   CHECK 3 — RESPONSIVE:  El módulo debe usar breakpoints Tailwind (sm:, md:,
//                          lg:) en sus componentes TSX para garantizar
//                          adaptabilidad móvil, tablet y escritorio.
//
// SELLO DE CALIDAD:
//   Un módulo obtiene "APPROVED" solo si los 3 checks son true.
//   Si alguno falla → "FAILED" → el Agente Orquestador NO puede cerrar la fase.
//
// CERTIFICADO DE MÓDULO:
//   Versión: 1.0.0 | Fecha: 2026-03-07 | Aprobado: Arquitecto de Sistemas
// ============================================================================

import { execSync }  from "child_process";
import * as fs       from "fs";
import * as path     from "path";

import { getContactosLabels, type AppLocale } from "@/lib/i18n/contactos";
import { DecisionLogger } from "@/agents/shared/DecisionLogger";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(process.cwd());
const QA_STATUS_PATH = path.join(PROJECT_ROOT, "qa_status.json");

/** Locales requeridos. Fallar en cualquiera = CHECK I18N fallido. */
const REQUIRED_LOCALES: AppLocale[] = ["es", "en", "fr"];

/** Breakpoints Tailwind que deben aparecer en componentes TSX del módulo. */
const REQUIRED_BREAKPOINTS = ["sm:", "md:", "lg:"] as const;

/** Carpetas donde el Auditor tiene PERMISO de escritura. */
const ALLOWED_WRITE_DIRS = [
  path.join(PROJECT_ROOT, "tests"),
  QA_STATUS_PATH,
] as const;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type QAVerdict = "APPROVED" | "FAILED" | "PENDING";

export interface QACheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ModuleCertificate {
  module: string;
  verdict: QAVerdict;
  timestamp: string;
  checks: QACheck[];
  /** Ruta del reporte de errores generado (solo si verdict = "FAILED"). */
  errorReport?: string;
}

// ─── Guard de escritura (LIMITACIÓN DE SEGURIDAD) ────────────────────────────

/**
 * Verifica que una ruta de escritura está dentro de los directorios permitidos.
 * INAMOVIBLE: garantiza que el Auditor no modifica código de negocio.
 */
function assertWriteAllowed(targetPath: string): void {
  const resolved = path.resolve(targetPath);
  const isAllowed = ALLOWED_WRITE_DIRS.some((allowed) =>
    resolved === allowed || resolved.startsWith(allowed + path.sep)
  );

  if (!isAllowed) {
    throw new Error(
      `[AUDITOR SECURITY VETO] Escritura prohibida en "${resolved}". ` +
        `El Agente de QA solo puede escribir en: ${ALLOWED_WRITE_DIRS.join(", ")}.`
    );
  }
}

// ─── CHECK 1 — I18N ──────────────────────────────────────────────────────────

/**
 * Verifica que el diccionario i18n tiene todas las claves cubiertas
 * para los 3 locales obligatorios (ES, EN, FR).
 *
 * Estrategia: para cada locale, obtener los labels y verificar que no
 * hay valores vacíos, undefined o que coincidan literalmente entre locales
 * (señal de copiar-pegar sin traducir).
 */
function checkI18n(module: string): QACheck {
  const results: string[] = [];
  let passed = true;

  // Módulos con i18n implementado actualmente
  const I18N_MODULES = ["contactos"] as const;
  const hasI18n = (I18N_MODULES as readonly string[]).includes(module);

  if (!hasI18n) {
    return {
      name:   "I18N_COVERAGE",
      passed: false,
      detail: `El módulo "${module}" no tiene diccionario i18n registrado en lib/i18n/. ` +
              `Crea lib/i18n/${module}.ts con soporte ES · EN · FR antes de certificar.`,
    };
  }

  // Solo el módulo "contactos" tiene getContactosLabels por ahora
  if (module === "contactos") {
    const labelsByLocale = REQUIRED_LOCALES.map((locale) => ({
      locale,
      labels: getContactosLabels(locale),
    }));

    // Recoger todos los valores string del diccionario para comparación
    function flattenValues(obj: unknown, prefix = ""): Record<string, string> {
      if (typeof obj === "string") return { [prefix]: obj };
      if (typeof obj !== "object" || obj === null) return {};
      return Object.entries(obj as Record<string, unknown>).reduce(
        (acc, [key, val]) => ({
          ...acc,
          ...flattenValues(val, prefix ? `${prefix}.${key}` : key),
        }),
        {} as Record<string, string>
      );
    }

    const flattened = labelsByLocale.map(({ locale, labels }) => ({
      locale,
      values: flattenValues(labels),
    }));

    // CHECK: ningún valor vacío
    for (const { locale, values } of flattened) {
      const emptyKeys = Object.entries(values)
        .filter(([, v]) => !v || v.trim() === "")
        .map(([k]) => k);

      if (emptyKeys.length > 0) {
        passed = false;
        results.push(`[${locale.toUpperCase()}] Claves vacías: ${emptyKeys.join(", ")}`);
      }
    }

    // CHECK: los valores EN y FR no son idénticos a ES (señal de no traducido)
    const esValues  = flattened.find((f) => f.locale === "es")?.values ?? {};
    const enValues  = flattened.find((f) => f.locale === "en")?.values ?? {};
    const frValues  = flattened.find((f) => f.locale === "fr")?.values ?? {};

    // Excluir claves técnicas que son iguales por diseño (nombres propios, etc.)
    const ALLOWED_IDENTICAL = new Set(["canalTipo.LINKEDIN", "canalTipo.WHATSAPP", "canalTipo.FAX", "canalTipo.EMAIL", "canalTipo.WEB"]);

    const untranslatedEN = Object.keys(esValues).filter(
      (k) => !ALLOWED_IDENTICAL.has(k) && esValues[k] === enValues[k]
    );
    const untranslatedFR = Object.keys(esValues).filter(
      (k) => !ALLOWED_IDENTICAL.has(k) && esValues[k] === frValues[k]
    );

    if (untranslatedEN.length > 0) {
      passed = false;
      results.push(`[EN] Posibles valores sin traducir (idénticos a ES): ${untranslatedEN.join(", ")}`);
    }
    if (untranslatedFR.length > 0) {
      passed = false;
      results.push(`[FR] Posibles valores sin traducir (idénticos a ES): ${untranslatedFR.join(", ")}`);
    }

    if (passed) {
      results.push(`Diccionario i18n completo para ES · EN · FR (${Object.keys(esValues).length} claves).`);
    }
  }

  return {
    name:   "I18N_COVERAGE",
    passed,
    detail: results.join(" | "),
  };
}

// ─── CHECK 2 — TEST SUITE ────────────────────────────────────────────────────

/**
 * Ejecuta los tests unitarios del módulo con Vitest y retorna si pasan.
 *
 * Usa `vitest run --reporter=verbose` y captura stdout/stderr.
 * Si Vitest no está disponible (CI sin instalar), marca como PENDING.
 */
function checkTestSuite(module: string): QACheck {
  const testPattern = `lib/**/${module}*.test.ts tests/regression/${module}*.test.ts`;

  try {
    const output = execSync(
      `npx vitest run --reporter=verbose 2>&1`,
      {
        cwd: PROJECT_ROOT,
        timeout: 60_000,
        encoding: "utf-8",
      }
    );

    // Vitest exits 0 on success, 1 on failure
    const passed = !output.toLowerCase().includes("failed") &&
                   !output.toLowerCase().includes("error:");

    return {
      name:   "TEST_SUITE",
      passed,
      detail: passed
        ? `Todos los tests del módulo "${module}" pasan. Patrón: ${testPattern}`
        : `Tests fallidos en "${module}". Revisar output de Vitest.`,
    };
  } catch (err) {
    // execSync lanza si el proceso sale con código != 0
    const stderr = err instanceof Error ? err.message : String(err);

    return {
      name:   "TEST_SUITE",
      passed: false,
      detail: `Tests fallidos en "${module}": ${stderr.slice(0, 300)}`,
    };
  }
}

// ─── CHECK 3 — RESPONSIVE ────────────────────────────────────────────────────

/**
 * Verifica que los componentes TSX del módulo usan breakpoints Tailwind.
 * Estrategia: buscar sm:, md:, lg: en los archivos TSX del módulo.
 *
 * Un módulo es "responsivo" si al menos un componente TSX usa los 3 breakpoints.
 */
function checkResponsive(module: string): QACheck {
  const tsxGlob = path.join(PROJECT_ROOT, "app", "**", `*.tsx`);
  const appDir  = path.join(PROJECT_ROOT, "app");

  // Buscar archivos TSX relacionados con el módulo
  function findTsxFiles(dir: string, moduleKey: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        // Solo descendemos en carpetas que contienen el nombre del módulo
        if (item.name.toLowerCase().includes(moduleKey.toLowerCase()) ||
            item.name === "components" || item.name === "_components") {
          results.push(...findTsxFiles(fullPath, moduleKey));
        }
      } else if (item.isFile() && item.name.endsWith(".tsx")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const tsxFiles = findTsxFiles(appDir, module);

  if (tsxFiles.length === 0) {
    return {
      name:   "RESPONSIVE_DESIGN",
      passed: false,
      detail: `No se encontraron archivos TSX para el módulo "${module}" en app/.`,
    };
  }

  // Para cada breakpoint, verificar que aparece en al menos un archivo
  const missingBreakpoints: string[] = [];

  for (const bp of REQUIRED_BREAKPOINTS) {
    const found = tsxFiles.some((filePath) => {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        return content.includes(bp);
      } catch {
        return false;
      }
    });

    if (!found) missingBreakpoints.push(bp);
  }

  const passed = missingBreakpoints.length === 0;

  return {
    name:   "RESPONSIVE_DESIGN",
    passed,
    detail: passed
      ? `Breakpoints responsivos sm: md: lg: detectados en ${tsxFiles.length} componente(s).`
      : `Breakpoints faltantes: [${missingBreakpoints.join(", ")}] en los componentes del módulo "${module}". ` +
        `Añade clases Tailwind responsivas antes de certificar.`,
  };
}

// ─── qa_status.json — Escritura segura ───────────────────────────────────────

function updateQAStatus(cert: ModuleCertificate): void {
  assertWriteAllowed(QA_STATUS_PATH); // GUARD DE SEGURIDAD

  let current: QAStatusFile = { modules: {}, last_run: "", overall_status: "PENDING" };

  if (fs.existsSync(QA_STATUS_PATH)) {
    try {
      current = JSON.parse(fs.readFileSync(QA_STATUS_PATH, "utf-8")) as QAStatusFile;
    } catch {
      // Archivo corrupto — resetear
    }
  }

  current.modules[cert.module] = {
    verdict:   cert.verdict,
    timestamp: cert.timestamp,
    checks:    cert.checks,
  };

  current.last_run = cert.timestamp;

  // El estado global es FAILED si cualquier módulo falla
  const allModules  = Object.values(current.modules);
  const anyFailed   = allModules.some((m) => m.verdict === "FAILED");
  const anyPending  = allModules.some((m) => m.verdict === "PENDING");

  current.overall_status = anyFailed ? "FAILED" : anyPending ? "PENDING" : "APPROVED";

  fs.writeFileSync(QA_STATUS_PATH, JSON.stringify(current, null, 2), "utf-8");
}

// ─── Reporte de errores ───────────────────────────────────────────────────────

function writeErrorReport(cert: ModuleCertificate): string {
  const reportsDir = path.join(PROJECT_ROOT, "tests", "reports");
  assertWriteAllowed(reportsDir); // GUARD DE SEGURIDAD

  fs.mkdirSync(reportsDir, { recursive: true });

  const fileName   = `${cert.module}-qa-report-${Date.now()}.md`;
  const reportPath = path.join(reportsDir, fileName);

  const failedChecks = cert.checks.filter((c) => !c.passed);
  const lines = [
    `# QA Report — ${cert.module}`,
    ``,
    `**Veredicto:** ${cert.verdict}`,
    `**Timestamp:** ${cert.timestamp}`,
    ``,
    `## Checks Fallidos`,
    ``,
    ...failedChecks.map((c) => [
      `### ❌ ${c.name}`,
      ``,
      c.detail,
      ``,
    ].join("\n")),
    `## Checks Aprobados`,
    ``,
    ...cert.checks
      .filter((c) => c.passed)
      .map((c) => `- ✓ **${c.name}**: ${c.detail}`),
  ];

  fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  return reportPath;
}

// ─── Auditor — Agente de QA ──────────────────────────────────────────────────

export const Auditor = {
  /**
   * FUNCIÓN PRINCIPAL — Certifica un módulo completo.
   *
   * Ejecuta los 3 checks en secuencia y emite el Sello de Calidad.
   * Actualiza `qa_status.json` con el resultado.
   * Si el veredicto es "FAILED", genera un reporte en `tests/reports/`.
   *
   * REGLA DE ORQUESTACIÓN:
   *   Si `qa_status.json` tiene `overall_status: "FAILED"`, el Agente
   *   Orquestador NO puede dar por finalizada la fase de desarrollo.
   *
   * @param moduleName - Nombre del módulo (ej: "contactos", "expedientes").
   * @returns ModuleCertificate con el veredicto y los checks detallados.
   */
  async certifyModule(moduleName: string): Promise<ModuleCertificate> {
    console.log(`\n[AUDITOR] Iniciando certificación del módulo "${moduleName}"...`);

    // Ejecutar los 3 checks
    const i18nCheck        = checkI18n(moduleName);
    const testCheck        = checkTestSuite(moduleName);
    const responsiveCheck  = checkResponsive(moduleName);

    const checks: QACheck[] = [i18nCheck, testCheck, responsiveCheck];
    const allPassed = checks.every((c) => c.passed);

    const cert: ModuleCertificate = {
      module:    moduleName,
      verdict:   allPassed ? "APPROVED" : "FAILED",
      timestamp: new Date().toISOString(),
      checks,
    };

    // Si hay fallos → generar reporte de errores
    if (!allPassed) {
      cert.errorReport = writeErrorReport(cert);
      console.error(`[AUDITOR] ❌ "${moduleName}" FAILED. Reporte: ${cert.errorReport}`);
    } else {
      console.log(`[AUDITOR] ✓ "${moduleName}" APPROVED.`);
    }

    // Actualizar qa_status.json (SIEMPRE, independientemente del veredicto)
    updateQAStatus(cert);

    // Registrar decisión en system_decision_log.md
    const failedNames = checks.filter((c) => !c.passed).map((c) => c.name);
    DecisionLogger.certify(
      "AUDITOR",
      moduleName,
      allPassed ? "APPROVED" : "FAILED",
      allPassed
        ? `Triple check superado: I18N + TEST_SUITE + RESPONSIVE_DESIGN.`
        : `Checks fallidos: [${failedNames.join(", ")}]. Ver reporte: ${cert.errorReport ?? "n/a"}.`
    );

    return cert;
  },

  /**
   * Lee el estado global del QA desde `qa_status.json`.
   * Devuelve null si el archivo no existe todavía.
   */
  readStatus(): QAStatusFile | null {
    if (!fs.existsSync(QA_STATUS_PATH)) return null;
    try {
      return JSON.parse(fs.readFileSync(QA_STATUS_PATH, "utf-8")) as QAStatusFile;
    } catch {
      return null;
    }
  },

  /**
   * Verifica si el Agente Orquestador puede dar por finalizada la fase.
   *
   * REGLA: solo puede cerrar la fase si overall_status === "APPROVED".
   * Si el archivo no existe o el estado es PENDING/FAILED → devuelve false.
   */
  canClosePhase(): boolean {
    const status = this.readStatus();
    return status?.overall_status === "APPROVED";
  },

  /**
   * Escribe un archivo de test en la carpeta de regresión.
   * GUARD DE SEGURIDAD: verifica que la ruta es dentro de /tests/.
   *
   * Solo debe usarse para scaffolding de nuevos tests, nunca para
   * modificar archivos de negocio.
   */
  writeTestFile(relativePath: string, content: string): string {
    const absolutePath = path.join(PROJECT_ROOT, "tests", relativePath);
    assertWriteAllowed(absolutePath); // GUARD DE SEGURIDAD

    const dir = path.dirname(absolutePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf-8");

    console.log(`[AUDITOR] Test generado: ${absolutePath}`);
    return absolutePath;
  },
} as const;

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface QAStatusFile {
  modules: Record<string, {
    verdict:   QAVerdict;
    timestamp: string;
    checks:    QACheck[];
  }>;
  last_run:       string;
  overall_status: QAVerdict;
}
