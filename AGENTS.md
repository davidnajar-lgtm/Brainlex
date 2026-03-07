# AGENTS.md — Gobernanza del Sistema de Agentes BRAINLEX

> **Documento canónico de identidad, responsabilidades y poderes de VETO.**
> Toda sesión de Claude Code debe leer este archivo antes de implementar
> cualquier módulo que afecte a Contactos, esquema de datos o interfaz de usuario.

---

## Jerarquía de Agentes

```
Arquitecto Jefe (Project Manager)
├── @Security-CISO       → agents/legal/Guardian.ts
├── @Data-Architect      → agents/data/TaxonomyManager.ts
├── @Backend-Agent       → agents/backend/index.ts
├── @Frontend-UX         → agents/frontend/index.ts
├── @Performance-Agent   → agents/performance/Optimizer.ts
└── @QA-Engineer         → agents/qa/Auditor.ts
```

**Regla de oro:** ninguna línea de código puede ser aprobada si no cumple
las reglas de `@Security-CISO`. El veto del CISO es el de mayor rango.

---

## Agente 1 — @Security-CISO (Agente Legal)

**Archivo:** `agents/legal/Guardian.ts`
**Middleware:** `lib/services/legalAgent.middleware.ts`

### Misión
Proteger la integridad legal y la privacidad de los datos.
Garantizar que ningún registro con historial comercial sea destruido físicamente.

### Poderes de VETO (HARDCODED — INAMOVIBLES)

| # | Veto | Descripción |
|---|------|-------------|
| L1 | **No al Borrado Directo** | Si `checkDependencies()` detecta expedientes, facturas o documentos activos → la API **ignora** la orden de destrucción. El botón no solo se oculta: el endpoint devuelve HTTP 403 y no ejecuta el DELETE. |
| L2 | **Cuarentena Automática** | Si hay dependencias legales → el contacto transiciona automáticamente a `QUARANTINE` con plazo de conservación legal (default 60 meses — art. 30 Código de Comercio). |
| L3 | **AuditLog Antes de Mutar** | Todo intento de borrado o archivado escribe en `audit_logs` **antes** de mutar el estado. La tabla `audit_logs` es INMUTABLE (sin UPDATE, sin DELETE). |
| L4 | **Motivo Obligatorio** | La cuarentena explícita (Archivar) requiere `quarantine_reason` con mínimo 5 caracteres. Sin motivo → HTTP 422. |

### Flujo de 3 Fases (Micro-Spec 1.2)

```
FASE 1 — Auditoría:   checkDependencies(contactoId)
          ↓ blocked=true              ↓ blocked=false
FASE 2 — Bloqueo:     QUARANTINE      —
          ↓                           ↓
FASE 3 — Veredicto:   LegalBlockError DELETE físico autorizado
                      (HTTP 403)
```

### Certificado de Módulo
```typescript
Guardian.issueCertificate("contactos-v1", contactoId)
// → { verdict: "APPROVED" | "BLOCKED", reasons: [...] }
```

---

## Agente 2 — @Data-Architect (Agente de Datos)

**Archivo:** `agents/data/TaxonomyManager.ts`

### Misión
Blindar el esquema de `Contactos`. Garantizar que los campos de comunicación
siguen el formato de "Campos Fijos" unificado. Ningún campo ad-hoc se añade
al modelo `Contacto`.

### Campos Fijos de Comunicación (Whitelist Canónica)

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `email_principal` | String UNIQUE | Formato email válido |
| `telefono_movil` | String | Formato E.164 internacional |
| `telefono_fijo` | String | Formato E.164 internacional |
| `website_url` | String | URL normalizada a https:// |
| `linkedin_url` | String | URL válida |
| `canal_preferido` | Enum | `"EMAIL"` \| `"MOVIL"` |

### Poderes de VETO

| # | Veto | Descripción |
|---|------|-------------|
| D1 | **No a Campos Ad-Hoc** | Ningún campo de comunicación fuera de la whitelist puede añadirse a `Contacto`. Todo canal adicional va a la tabla `canales_comunicacion`. |
| D2 | **Whitelist de CanalTipo** | `CanalComunicacion.tipo` solo acepta: `TELEFONO`, `EMAIL`, `WEB`, `LINKEDIN`, `WHATSAPP`, `FAX`, `OTRA`. Cualquier otro tipo lanza `SchemaVetoError`. |
| D3 | **No a Duplicados de Contacto** | El índice `@@unique([fiscal_id, fiscal_id_tipo])` y `email_principal @unique` son inamovibles. El repositorio debe capturar `P2002` y devolver error legible. |

---

## Agente 3 — @Backend-Agent

**Archivo:** `agents/backend/index.ts`

### Misión
Garantizar que toda la lógica de negocio reside en el servidor.
Nunca exponer lógica de negocio al cliente.

### Reglas Operativas

- Toda Server Action valida con Zod **antes** de persistir.
- Toda operación de mutación pasa por el Repository Pattern.
- Las transacciones multi-tabla usan `prisma.$transaction()`.
- Los resultados siguen el Result Pattern: `{ ok: true; data } | { ok: false; error }`.
- Ningún `prisma.contacto.delete()` puede llamarse directamente: siempre a través de `Guardian.validateDelete()`.

---

## Agente 4 — @Frontend-UX

**Archivo:** `agents/frontend/index.ts`

### Misión
Construir interfaces simples, accesibles y rápidas con Shadcn/UI.
Operar bajo las restricciones del Agente de Rendimiento.

### Reglas Operativas

- Dark theme first (`#0d0d0d` background).
- Formularios conectados a esquemas Zod del servidor.
- Sin llamadas directas a APIs externas desde Client Components.
- Recibir y respetar los VETOs del Agente de Rendimiento.

---

## Agente 5 — @Performance-Agent (Agente de Rendimiento)

**Archivo:** `agents/performance/Optimizer.ts`

### Misión
Auditar tiempos de respuesta de APIs y peso de componentes de Frontend.
Emitir VETO sobre cualquier implementación que degrade la UX por latencia.

### Poderes de VETO *(poder sobre @Frontend-UX y @Data-Architect)*

| # | Veto | Constante | Descripción |
|---|------|-----------|-------------|
| P1 | **Presupuesto de Carga** | `LOAD_BUDGET_MS = 200` | Ninguna página puede superar 200ms de TTI. Cualquier implementación que lo supere recibe VETO. |
| P2 | **Paginación Obligatoria** | `MAX_PAGE_SIZE = 50` | El Agente de Datos DEBE usar cursor-based pagination. Prohibido cargar listas completas. |
| P3 | **Google Maps Lazy** | — | Google Maps solo se carga con `next/dynamic + ssr:false` en el componente estricto. NUNCA en layout global. |
| P4 | **No al Efecto Árbol de Navidad** | 60 fps | Sin animaciones o gráficos que degraden el scroll. Charts y visualizaciones pesadas requieren lazy loading. |
| P5 | **Caché SWR Obligatoria** | `CLIENT_CACHE_TTL_SECONDS = 60` | Los contactos ya visitados se sirven desde caché SWR. Sin re-fetch innecesario. |

### Configuración SWR Recomendada

```typescript
import { Optimizer } from "@/agents/performance/Optimizer";

// Para entidades individuales (Contacto):
const config = Optimizer.getContactoSWRConfig();

// Para listas paginadas:
const listConfig = Optimizer.getListSWRConfig();
```

### Paginación Cursor-Based (Obligatoria para Listas)

```typescript
import { Optimizer } from "@/agents/performance/Optimizer";

const prismaPage = Optimizer.buildPrismaPage({ pageSize: 20, cursor: lastId });
// → { take: 20, cursor: { id: lastId }, skip: 1 }
```

---

## Agente 6 — @QA-Engineer (The Auditor)

**Archivo:** `agents/qa/Auditor.ts`
**Tests:** `tests/regression/`
**Estado:** `qa_status.json` (raíz)

### Misión
Verificar la calidad técnica de cada módulo antes de su paso a producción.
Emitir el "Sello de Calidad" QA. Actualizar `qa_status.json` tras cada tarea.

### Limitaciones de Seguridad (INAMOVIBLES)

| Tipo | Regla |
|------|-------|
| PROHIBIDO | Modificar cualquier archivo fuera de `/tests/` y `qa_status.json` |
| PROHIBIDO | Importar módulos de negocio con efectos de escritura |
| PERMITIDO | Leer archivos de negocio para auditoría estática |
| PERMITIDO | Escribir archivos en `/tests/` y reportes en `tests/reports/` |
| PERMITIDO | Actualizar `qa_status.json` en la raíz |

### Checks de certifyModule()

| # | Check | Descripción |
|---|-------|-------------|
| Q1 | **I18N_COVERAGE** | Ningún texto de UI puede estar hardcoded. El diccionario i18n debe cubrir ES · EN · FR sin claves vacías ni valores idénticos entre locales. |
| Q2 | **TEST_SUITE** | Los tests unitarios del módulo deben pasar al 100% (`vitest run`). |
| Q3 | **RESPONSIVE_DESIGN** | Los componentes TSX deben usar breakpoints Tailwind `sm:` `md:` `lg:`. |

### Regla de Orquestación (BLOQUEANTE)

```
si qa_status.json → overall_status === "FAILED"
  → el Agente Orquestador NO puede dar por finalizada la fase
```

### Uso

```typescript
import { Auditor } from "@/agents/qa/Auditor";

const cert = await Auditor.certifyModule("contactos");
// cert.verdict === "APPROVED" | "FAILED"
// qa_status.json actualizado automáticamente

// El Orquestador consulta si puede cerrar la fase:
const canClose = Auditor.canClosePhase();
```

---

## Proceso de Certificación de Módulo (Triple Sello)

Antes de pasar cualquier módulo a producción, los **4 agentes** deben emitir
su certificado con veredicto **APPROVED**:

### 1. Certificado del Agente Legal
```typescript
const legal = await Guardian.issueCertificate("modulo-nombre", contactoId);
// Verificar: legal.verdict === "APPROVED"
```

### 2. Certificado del Agente de Rendimiento
```typescript
const checks = Optimizer.buildStandardChecks({
  usesPagination:     true,
  usesSWRCache:       true,
  googleMapsIsLazy:   true,
  noGlobalAnimations: true,
  estimatedTTIms:     150,
});
const perf = Optimizer.issueCertificate("modulo-nombre", checks);
// Verificar: perf.verdict === "APPROVED"
```

### 3. Certificado del Agente de QA
```typescript
const qa = await Auditor.certifyModule("modulo-nombre");
// Verificar: qa.verdict === "APPROVED"
// qa_status.json → overall_status === "APPROVED"
```

### 4. Revisión Manual del Arquitecto Jefe
- Schema de Prisma no modificado sin autorización explícita.
- Sin `prisma.contacto.delete()` directos en el código.
- Sin campos de comunicación ad-hoc en `Contacto`.
- Sin imports de Google Maps en layouts o bundles globales.

---

## Matriz de Decisión y Configuración Completa

La configuración completa de funciones, constraints, presupuestos y protocolo está en:
**[agents/config.json](agents/config.json)**

---

## Protocolo de Comunicación — Vibe Coding Flow

Obligatorio para toda tarea de implementación. Definido en `agents/config.json → communication_protocol`.

```
PASO 1 — ANALYZE_MICRO_SPEC
  Leer la Micro-Spec antes de proponer cualquier plan.
  Identificar qué agentes están afectados.
        ↓
PASO 2 — REQUEST_VISTO_BUENO
  Pedir confirmación explícita al agente afectado.
  Si hay VETO activo → el plan no avanza.
        ↓
PASO 3 — WRITE_TEST_FIRST  (TDD)
  @QA-Engineer escribe el test ANTES que la lógica.
  NO test → NO implementation.
        ↓
PASO 4 — IMPLEMENT
  Implementar siguiendo las constraints de cada agente.
  Cada decisión → DecisionLogger → system_decision_log.md
        ↓
PASO 5 — TRIPLE_CERTIFICATION
  Guardian.issueCertificate()   → APPROVED
  Optimizer.issueCertificate()  → APPROVED
  Auditor.certifyModule()       → APPROVED
  qa_status.json overall_status → APPROVED
```

**Reglas de escalación:**
- Conflicto entre agentes → Arquitecto Jefe decide; `@Security-CISO` prevalece siempre en seguridad.
- VETO activo → documentar en `system_decision_log.md` y escalar con propuesta alternativa.
- `qa_status.json overall_status=FAILED` → ningún agente puede cerrar la fase.

---

## Registro de Auditoría

Toda decisión significativa queda registrada en:
**[system_decision_log.md](system_decision_log.md)**

Escrito automáticamente por `agents/shared/DecisionLogger.ts`.
Agentes con permiso: `GUARDIAN`, `ARCHITECT`, `SPEEDSTER`, `AUDITOR`. Log **APPEND-ONLY**.

---

## Historial de Cambios

| Fecha | Versión | Cambio | Agente |
|-------|---------|--------|--------|
| 2026-03-07 | 1.0.0 | Creación inicial: Guardian, TaxonomyManager, Optimizer | Arquitecto Jefe |
| 2026-03-07 | 1.1.0 | Agente QA: Auditor, tests de regresión, qa_status.json | Arquitecto de Sistemas |
| 2026-03-07 | 1.2.0 | Matriz de Decisión: config.json, DecisionLogger, Vibe Coding Flow, system_decision_log.md | Arquitecto de Sistemas |
