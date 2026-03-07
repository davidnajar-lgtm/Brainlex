# system_decision_log.md — Registro de Decisiones de Agentes

> **APPEND-ONLY.** Este archivo es inmutable: ninguna entrada puede modificarse ni borrarse.
> Generado y mantenido por `agents/shared/DecisionLogger.ts`.
> Cada agente con `log_all_decisions: true` escribe aquí sus veredictos.

---

## Guía de lectura

| Campo | Descripción |
|-------|-------------|
| **Timestamp** | ISO 8601 UTC — cuándo se tomó la decisión |
| **Agente** | ID del agente responsable (GUARDIAN, ARCHITECT, SPEEDSTER, AUDITOR) |
| **Acción** | Función invocada (interceptDelete, certifyModule, assertBudget…) |
| **Módulo** | Entidad o módulo afectado, con `[resource_id]` si aplica |
| **Veredicto** | APPROVED / VETOED / QUARANTINED / PURGED / FAILED / INFO |
| **Detalle** | Descripción legible de la decisión y motivo |

---

## Registro

| Timestamp | Agente | Acción | Módulo | Veredicto | Detalle |
|-----------|--------|--------|--------|-----------|---------|
| 2026-03-07T00:00:00.000Z | AUDITOR | init | system | **INFO** | Sistema de agentes SSD inicializado. Matriz de decisión v1.1.0 cargada. Agentes registrados: GUARDIAN, ARCHITECT, SPEEDSTER, AUDITOR, BACKEND, FRONTEND. |
| 2026-03-07T00:00:00.000Z | GUARDIAN | init | contactos | **INFO** | Agente Legal activo. Veto hardcoded sobre prisma.contacto.delete() operativo. AuditLog inmutable en tabla audit_logs. |
| 2026-03-07T00:00:00.000Z | ARCHITECT | init | contactos | **INFO** | Agente de Datos activo. Campos Fijos de Comunicación bloqueados (6 campos). Whitelist CanalTipo operativa (7 tipos). |
| 2026-03-07T00:00:00.000Z | SPEEDSTER | init | system | **INFO** | Agente de Rendimiento activo. Presupuesto TTI=200ms, MAX_PAGE_SIZE=50, CLIENT_CACHE_TTL=60s. Google Maps lazy-only. |
| 2026-03-07T00:00:00.000Z | AUDITOR | init | system | **INFO** | Agente de QA activo. qa_status.json inicializado como PENDING. Tests de regresión en tests/regression/. Guard de escritura operativo. |
