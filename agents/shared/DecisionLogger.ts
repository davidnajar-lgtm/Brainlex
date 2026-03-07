// ============================================================================
// agents/shared/DecisionLogger.ts — Logger de Decisiones de Agentes
//
// @role:   Compartido por todos los agentes con log_all_decisions=true
// @spec:   agents/config.json → decision_log
//
// RESPONSABILIDAD:
//   Escribir entradas en 'system_decision_log.md' cada vez que un agente
//   toma una decisión significativa (VETO, APPROVE, QUARANTINE, etc.).
//   El log es APPEND-ONLY: nunca se sobreescribe, nunca se borra una entrada.
//
// SEGURIDAD:
//   Solo los agentes listados en config.json → decision_log.write_allowed_agents
//   pueden escribir en este archivo. La validación se hace en tiempo de ejecución.
//
// FORMATO DE ENTRADA:
//   | timestamp (ISO) | agente | acción | módulo | veredicto | detalle |
// ============================================================================

import * as fs   from "fs";
import * as path from "path";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROJECT_ROOT    = path.resolve(process.cwd());
const LOG_FILE_PATH   = path.join(PROJECT_ROOT, "system_decision_log.md");

/** Agentes con permiso de escritura en el log (espejo de config.json). */
const ALLOWED_WRITERS = new Set(["GUARDIAN", "ARCHITECT", "SPEEDSTER", "AUDITOR"] as const);

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AgentId = "GUARDIAN" | "ARCHITECT" | "SPEEDSTER" | "AUDITOR";

export type DecisionVerdict =
  | "APPROVED"
  | "VETOED"
  | "QUARANTINED"
  | "PURGED"
  | "FAILED"
  | "PENDING"
  | "INFO";

export interface DecisionEntry {
  /** ID del agente que toma la decisión. */
  agent: AgentId;
  /** Acción ejecutada (ej. "interceptDelete", "certifyModule", "assertBudget"). */
  action: string;
  /** Módulo o entidad afectada (ej. "contactos", "expedientes"). */
  module: string;
  /** Veredicto de la decisión. */
  verdict: DecisionVerdict;
  /** Detalle legible de la decisión. */
  detail: string;
  /** ID del recurso afectado (opcional, ej. contactoId). */
  resource_id?: string;
}

// ─── Guard de escritura ───────────────────────────────────────────────────────

function assertWriterAllowed(agentId: string): asserts agentId is AgentId {
  if (!ALLOWED_WRITERS.has(agentId as AgentId)) {
    throw new Error(
      `[DECISION LOGGER] El agente "${agentId}" no tiene permiso de escritura ` +
        `en system_decision_log.md. Agentes permitidos: ${[...ALLOWED_WRITERS].join(", ")}.`
    );
  }
}

// ─── Formateo de entrada ──────────────────────────────────────────────────────

function formatRow(entry: DecisionEntry, timestamp: string): string {
  // Escapa pipes de Markdown en el campo detail para no romper la tabla
  const detail = entry.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const resource = entry.resource_id ? ` [${entry.resource_id}]` : "";

  return `| ${timestamp} | ${entry.agent} | ${entry.action} | ${entry.module}${resource} | **${entry.verdict}** | ${detail} |`;
}

// ─── Inicializar archivo si no existe ────────────────────────────────────────

function ensureLogFile(): void {
  if (!fs.existsSync(LOG_FILE_PATH)) {
    const header = [
      "# system_decision_log.md — Registro de Decisiones de Agentes",
      "",
      "> **APPEND-ONLY.** Este archivo es inmutable: ninguna entrada puede modificarse ni borrarse.",
      "> Generado automáticamente por `agents/shared/DecisionLogger.ts`.",
      "",
      "| Timestamp | Agente | Acción | Módulo | Veredicto | Detalle |",
      "|-----------|--------|--------|--------|-----------|---------|",
      "",
    ].join("\n");

    fs.writeFileSync(LOG_FILE_PATH, header, "utf-8");
  }
}

// ─── DecisionLogger ───────────────────────────────────────────────────────────

export const DecisionLogger = {
  /**
   * Escribe una entrada en system_decision_log.md.
   *
   * APPEND-ONLY: solo añade líneas al final del archivo.
   * La entrada es visible en GitHub/VSCode como tabla Markdown.
   *
   * @throws Error si el agente no tiene permiso de escritura.
   */
  log(entry: DecisionEntry): void {
    assertWriterAllowed(entry.agent);
    ensureLogFile();

    const timestamp = new Date().toISOString();
    const row = formatRow(entry, timestamp) + "\n";

    fs.appendFileSync(LOG_FILE_PATH, row, "utf-8");
  },

  /**
   * Versión async para usar dentro de Server Actions o middleware.
   * Usa writeFile append para no bloquear el event loop.
   */
  async logAsync(entry: DecisionEntry): Promise<void> {
    assertWriterAllowed(entry.agent);
    ensureLogFile();

    const timestamp = new Date().toISOString();
    const row = formatRow(entry, timestamp) + "\n";

    await fs.promises.appendFile(LOG_FILE_PATH, row, "utf-8");
  },

  /**
   * Lee las últimas N entradas del log (para dashboards o reportes).
   * Devuelve las líneas crudas de la tabla Markdown.
   */
  readLast(n: number = 20): string[] {
    if (!fs.existsSync(LOG_FILE_PATH)) return [];

    const content = fs.readFileSync(LOG_FILE_PATH, "utf-8");
    const rows = content
      .split("\n")
      .filter((line) => line.startsWith("| 20")); // Filas con timestamp ISO

    return rows.slice(-n);
  },

  /**
   * Atajos semánticos para los casos más comunes.
   * Reducen el boilerplate en los agentes.
   */
  veto(agent: AgentId, action: string, module: string, detail: string, resource_id?: string): void {
    this.log({ agent, action, module, verdict: "VETOED", detail, resource_id });
  },

  approve(agent: AgentId, action: string, module: string, detail: string, resource_id?: string): void {
    this.log({ agent, action, module, verdict: "APPROVED", detail, resource_id });
  },

  quarantine(agent: AgentId, module: string, detail: string, resource_id?: string): void {
    this.log({ agent, action: "quarantine", module, verdict: "QUARANTINED", detail, resource_id });
  },

  certify(agent: AgentId, module: string, verdict: "APPROVED" | "FAILED", detail: string): void {
    this.log({ agent, action: "certifyModule", module, verdict, detail });
  },

  info(agent: AgentId, action: string, module: string, detail: string): void {
    this.log({ agent, action, module, verdict: "INFO", detail });
  },
} as const;
