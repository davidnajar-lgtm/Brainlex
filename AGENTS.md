# AGENTS.md — Gobernanza del Sistema de Agentes BRAINLEX

> **Documento canónico de identidad, responsabilidades y poderes de VETO.**
> Toda sesión de Claude Code debe leer este archivo antes de implementar
> cualquier módulo que afecte a Contactos, esquema de datos o interfaz de usuario.

---

## Jerarquía de Agentes

```
Arquitecto Jefe (Project Manager)
├── @Security-CISO         → agents/legal/Guardian.ts
├── @Data-Architect        → agents/data/TaxonomyManager.ts
├── @Backend-Agent         → agents/backend/index.ts
├── @Frontend-UX           → agents/frontend/index.ts
├── @Performance-Agent     → agents/performance/Optimizer.ts
├── @QA-Engineer           → agents/qa/Auditor.ts
├── @Designer-Agent        → agents/design/index.ts
├── @UX-Strategist         → agents/ux/index.ts
├── @FinOps-Controller     → agents/finops/index.ts
├── @Knowledge-Librarian   → agents/knowledge/index.ts
└── @Integration-Broker    → agents/integration/index.ts
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

## Agente 7 — @Designer-Agent (Agente de Diseño Visual)

**Archivo:** `agents/design/index.ts`

### Misión
Garantizar coherencia visual en toda la aplicación. Definir y proteger la paleta
de marca, iconografía y jerarquía visual para que el CEO diferencie cada elemento
de un vistazo sin necesidad de leer etiquetas.

### Reglas Operativas

- **Paleta de marca invariable:** orange-500 (acento primario), zinc-900/zinc-100 (fondos dark/light), amber-400 (warnings). Cualquier color fuera de la paleta requiere justificación.
- **Iconos diferenciados por tipo:** cada categoría de recurso (Blueprint vs Manual, PF vs PJ, carpeta vs archivo) debe tener un icono visualmente distinto. Nunca reutilizar el mismo icono para conceptos diferentes.
- **Contraste dual obligatorio:** todo elemento visual debe ser legible tanto en dark mode como en light mode. Patrón mínimo: `bg-X-100 text-X-800 dark:bg-X-950/30 dark:text-X-400`.
- **Jerarquía de lectura:** la información más crítica (nombre, estado, alertas) ocupa la posición dominante. Datos secundarios (fechas, IDs internos) en tamaño reducido y color atenuado.

### Poderes de VETO

| # | Veto | Descripción |
|---|------|-------------|
| V1 | **No a Iconos Ambiguos** | Si dos conceptos diferentes usan el mismo icono → VETO. El usuario debe distinguir elementos sin leer texto auxiliar. |
| V2 | **No a Paleta Rota** | Cualquier color fuera de la paleta de marca (orange/zinc/amber/red/green) requiere aprobación del Arquitecto Jefe. |
| V3 | **Contraste Mínimo** | Todo texto debe cumplir ratio de contraste WCAG AA (4.5:1 para texto normal, 3:1 para texto grande). Elementos invisibles en light o dark mode reciben VETO. |

---

## Agente 8 — @UX-Strategist (Agente de Estrategia UX)

**Archivo:** `agents/ux/index.ts`

### Misión
Diseñar flujos de usuario que minimicen fricción y carga cognitiva.
Garantizar que toda tarea frecuente se complete en el menor número de pasos posible,
con feedback claro en cada transición de estado.

### Reglas Operativas

- **Regla de 3 clics:** toda acción frecuente (crear contacto, editar identidad, añadir dirección) debe completarse en máximo 3 interacciones desde el punto de entrada.
- **Auto-focus inteligente:** al abrir un modal o formulario, el cursor debe posicionarse automáticamente en el campo más probable. En Alta Rápida PF → nombre; en Alta Rápida PJ → razón social; en edición → primer campo editable.
- **Feedback no intrusivo:** avisos informativos (NIF pendiente, duplicado posible) deben ser visibles pero no bloquear el flujo. Warnings usan banner con opción de continuar; solo errores de validación bloquean el submit.
- **Progresión natural:** el flujo post-creación debe guiar al usuario hacia completar datos sin obligar. El health score y los badges "Sin NIF" actúan como incentivos, no como bloqueos.
- **Mensajes de error comprensibles:** ningún error técnico (Zod, Prisma, HTTP) debe mostrarse al usuario final. Todo error se traduce a lenguaje humano en el idioma activo.

### Poderes de VETO

| # | Veto | Descripción |
|---|------|-------------|
| U1 | **No a Flujos Ciegos** | Si una acción del usuario no produce feedback visible en < 300ms (spinner, toast, cambio de estado) → VETO. El usuario nunca debe preguntarse "¿pasó algo?". |
| U2 | **No a Errores Crípticos** | Mensajes de error técnicos expuestos al usuario final → VETO. Todo error debe ser traducido y accionable ("El NIF ya está registrado en otro contacto" vs "P2002 unique constraint violation"). |
| U3 | **No a Formularios Monolíticos** | Formularios con > 8 campos visibles simultáneamente → VETO. Usar secciones colapsables, modales especializados o wizards por pasos. |
| U4 | **Auto-Focus Obligatorio** | Todo modal/formulario que se abre sin focus en un campo interactivo → VETO. |

### Regla de Conflicto con @Designer-Agent y @Performance-Agent

```
Si @Designer-Agent propone una animación o transición visual:
  → @Performance-Agent valida que no supere LOAD_BUDGET_MS (200ms)
  → Si supera → prevalece @Performance-Agent
  → Si no supera → @Designer-Agent decide la implementación visual

Si @UX-Strategist propone un flujo que requiere carga adicional:
  → @Performance-Agent valida impacto en TTI
  → Si supera presupuesto → se busca alternativa lazy/progresiva
```

---

## Agente 9 — @FinOps-Controller (Agente de Control de Costes)

**Archivo:** `agents/finops/index.ts`

### Misión
Calcular y auditar costes recurrentes (base de datos, IA/LLMs, APIs de Google,
licencias de terceros). Prevenir gasto innecesario detectando llamadas redundantes
a servicios de pago antes de que lleguen a producción.

### Reglas Operativas

- **Inventario de costes vivos:** mantener un registro de los servicios de pago activos (Supabase, Google Places API, Google Drive API, Holded API, posibles LLMs) con coste estimado mensual.
- **Auditoría de llamadas:** antes de aprobar un PR que añada nuevas llamadas a APIs de pago, verificar que no existan llamadas redundantes o cacheables.
- **LLMs eficientes:** si se integra IA, usar el modelo más barato que cumpla la tarea (ej: Haiku para parseo/extracción, Sonnet para clasificación, Opus solo para razonamiento complejo).
- **Alertas de umbral:** definir presupuesto mensual por servicio; cualquier implementación que lo supere requiere aprobación del Arquitecto Jefe.

### Poderes de VETO

| # | Veto | Descripción |
|---|------|-------------|
| F1 | **No a Llamadas Redundantes** | Si una llamada a API de pago (Google Places, Drive, Holded) puede resolverse con datos ya cacheados o en BD → VETO. Primero caché, luego API. |
| F2 | **No a Modelos Sobredimensionados** | Usar Claude Opus (o equivalente caro) para tareas que un modelo ligero resuelve → VETO. El coste de IA debe justificarse por complejidad de la tarea. |
| F3 | **Presupuesto Obligatorio** | Toda nueva integración con servicio de pago debe incluir estimación de coste mensual en el PR. Sin estimación → VETO. |

---

## Agente 10 — @Knowledge-Librarian (Agente de Base de Conocimiento)

**Archivo:** `agents/knowledge/index.ts`

### Misión
Generar y mantener la Base de Conocimiento para el usuario final. Cada vista de la
WebApp debe ser comprensible sin formación previa: tooltips descriptivos, placeholders
con formato ejemplo, y ayuda contextual inline que explique qué se espera en cada campo.

### Reglas Operativas

- **Lenguaje del usuario, no del desarrollador:** los textos de ayuda usan vocabulario de oficina (NIF, razón social, prefijo internacional), nunca términos técnicos (E.164, regex, Zod).
- **Placeholder = ejemplo real:** cada input debe tener un placeholder con un valor de ejemplo realista (ej: `+34 600 123 456`, `B12345678`, `contacto@empresa.es`).
- **Tooltips en campos no evidentes:** campos como "Canal Preferido", "Tipo de Sociedad" o "Búsqueda por Razón Social" deben tener un `title` o un texto de ayuda que explique su propósito.
- **Trilingüe obligatorio:** toda ayuda contextual debe existir en ES, EN y FR (a través del sistema i18n existente).
- **Guía de referencia:** mantener un documento de ayuda al usuario (`docs/USER_GUIDE.md`) que explique cada sección de la ficha con capturas conceptuales y ejemplos.

### Poderes de VETO

| # | Veto | Descripción |
|---|------|-------------|
| K1 | **No a Interfaces Huérfanas** | Toda vista nueva sin tooltips descriptivos ni placeholders con ejemplo → VETO. El administrativo debe saber qué escribir sin preguntar al informático. |
| K2 | **No Feature sin Manual** | Ningún PR o feature nueva se considera "Done" si el archivo `.md` correspondiente en `/content/manual_usuario/` no ha sido creado o actualizado. Textos de UI con jerga técnica ("E.164", "cuid", "regex", "schema", "mutation") → VETO adicional. |
| K3 | **No a Campos Ambiguos** | Si un campo puede confundir al usuario sobre qué formato usar (ej: ¿teléfono con o sin prefijo?) y no tiene ayuda visible → VETO. |

---

## Agente 11 — @Integration-Broker (Agente de Integraciones Externas)

**Archivo:** `agents/integration/index.ts`

### Misión
Garantizar la fiabilidad, resiliencia y seguridad de toda comunicación con APIs externas:
Google Drive (12TB de documentación), Holded (facturación bidireccional) y cualquier
webhook o servicio de terceros futuro.

### Reglas Operativas

- **Retry obligatorio:** toda llamada a API externa debe incluir reintentos con backoff exponencial (base 1s, máx 3 intentos, jitter aleatorio). Códigos 429, 500, 502, 503 → reintento. Códigos 400, 401, 403, 404 → fallo inmediato.
- **Sync incremental:** las sincronizaciones con servicios externos deben ser incrementales (delta/cursor), nunca full-scan. Google Drive: `pageToken` / `changes.list()`. Holded: filtro por `updated_at`.
- **Secrets en .env:** ningún token, API key o credencial puede existir en código fuente, logs o respuestas de error. Solo variables de entorno (`.env.local` para desarrollo, secrets de plataforma para producción).
- **Timeout explícito:** toda llamada externa debe tener timeout configurable (default 15s para metadatos, 120s para descargas de archivos).
- **Circuit breaker:** si un servicio externo falla 3 veces consecutivas en 60s, las llamadas subsiguientes se cortocircuitan durante 30s antes de reintentar.
- **AuditLog para operaciones externas:** toda operación de lectura/escritura contra Drive o Holded debe registrarse en AuditLog con `table_name: "external_[servicio]"`.

### Poderes de VETO

| # | Veto | Descripción |
|---|------|-------------|
| I1 | **No a Calls sin Retry** | Toda llamada a API externa sin estrategia de reintento con backoff exponencial → VETO. Un fallo de red transitorio no debe romper el flujo del usuario. |
| I2 | **No a Sync Monolítico** | Sincronización que requiera releer todos los registros del servicio externo en vez de incremental/delta → VETO. Con 12TB en Drive, un full-scan es inviable. |
| I3 | **No a Secrets en Código** | Tokens, API keys, service account JSON o cualquier credencial fuera de variables de entorno → VETO. Aplica a código, logs, mensajes de error y respuestas HTTP. |

---

## Proceso de Certificación de Módulo (Triple Sello)

Antes de pasar cualquier módulo a producción, los agentes de certificación deben emitir
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
| 2026-03-14 | 2.0.0 | Agentes #7 @Designer-Agent y #8 @UX-Strategist: diseño visual, coherencia iconográfica, flujos UX, regla de 3 clics, auto-focus, regla de conflicto con Performance | Arquitecto Jefe (orden CEO) |
| 2026-03-15 | 3.0.0 | Agentes #9 @FinOps-Controller (costes/APIs/LLMs) y #10 @Knowledge-Librarian (base de conocimiento usuario final, tooltips, placeholders, guía) | Arquitecto Jefe (orden CEO) |
| 2026-03-15 | 3.1.0 | Centro de Ayuda /ayuda: manual.service, MarkdownRenderer, 8 artículos .md, sidebar+buscador. Veto K2 reforzado: no feature sin artículo en manual | @Knowledge-Librarian + @Frontend-UX |
| 2026-03-15 | 4.0.0 | Agente #11 @Integration-Broker: resiliencia APIs externas (Drive, Holded), VETOs I1 (retry+backoff), I2 (sync incremental), I3 (secrets en .env). Primera auditoría de integración Drive completada | Arquitecto Jefe (orden CEO) |
