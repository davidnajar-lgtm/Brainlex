# CONTEXT.md — Agente de Rendimiento (Speedster / Optimizer)

> Extraído de `docs/SSD_MASTER.md` y `agents/config.json`.
> Define los presupuestos de rendimiento y los VETOs que el Optimizer aplica
> sobre @Frontend-UX y @Data-Architect.

---

## Specs de Referencia
- **Transversal** — aplica a todos los módulos y fases

---

## Contexto de Volumen de Datos (Fuente: Contexto_Negocio_BrainLex.txt)

Este agente debe dimensionar TODAS sus decisiones de rendimiento contra estos volúmenes reales:

| Dimensión | Dato | Implicación técnica |
|-----------|------|---------------------|
| **Volumen documental** | 10–12 TB en Google Drive | Capa de caché de metadatos obligatoria; nunca cargar binarios en RAM |
| **Dispersión de datos** | Drive + A3 + Sudespacho + WhatsApp + Email | La clasificación IA debe ser incremental, no batch masivo |
| **Usuarios concurrentes** | 14 personas (12 LX + 2 LW) | Diseñar para 14 sesiones simultáneas sin degradación |
| **Entidades en directorio** | Años de operación acumulados | Paginación cursor-based obligatoria desde el primer deploy |
| **Tasa de subida documental** | Alta (flujo diario de despacho) | Ingesta asíncrona; no bloquear UI durante OCR/clasificación |

### Reglas de diseño derivadas del volumen

1. **Los metadatos de Drive se cachean en BD** (`drive_documents`) — nunca llamar a la Drive API en cada render.
2. **OCR/NLP se ejecuta en background** — el endpoint de ingesta devuelve ACK inmediato, el procesamiento es async.
3. **Listas de contactos/expedientes**: cursor-based pagination obligatoria. Con años de datos, un `findMany()` sin límite puede traer miles de registros.
4. **Presupuesto de 200ms TTI**: medido con datos reales de producción (no en BD vacía de desarrollo).
5. **Índices mínimos requeridos** en `contactos`: `status`, `fiscal_id`, `created_at`. En `expedientes`: `company_id`, `status`, `contacto_id`.

---

## Presupuestos de Rendimiento (Constantes — no modificar)

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `LOAD_BUDGET_MS` | 200 ms | TTI máximo por página |
| `MAX_PAGE_SIZE` | 50 registros | Máximo por llamada de lista |
| `CLIENT_CACHE_TTL_SECONDS` | 60 s | SWR TTL para entidades individuales |
| `LIST_CACHE_TTL_SECONDS` | 30 s | SWR TTL para listas paginadas |

---

## VETOs del Agente de Rendimiento

### VETO P1 — Presupuesto de Carga (200ms TTI)
Ninguna página puede superar 200ms de Time to Interactive.
Si una implementación lo supera → `PerformanceVetoError` con código `PERF_BUDGET_EXCEEDED`.

### VETO P2 — Paginación Obligatoria
El Agente de Datos DEBE usar cursor-based pagination en toda lista.
- Máximo `MAX_PAGE_SIZE = 50` registros por llamada.
- Prohibido `findMany()` sin `take/cursor` en listas de Contactos/Expedientes.
- Usar `Optimizer.buildPrismaPage({ pageSize, cursor })`.

### VETO P3 — Google Maps Lazy
Google Maps SOLO se carga con `next/dynamic + ssr:false` en el componente específico.
NUNCA en: `app/layout.tsx`, `app/[locale]/layout.tsx`, ni en ningún layout global.
Componentes autorizados: `PlacesAutocompleteInput.tsx`, `DireccionFormModal.tsx`.

### VETO P4 — No al Efecto Árbol de Navidad
Sin animaciones o gráficos que degraden el scroll a < 60fps.
Charts con D3, Three.js, Recharts u otras librerías pesadas → lazy loading obligatorio.

### VETO P5 — Caché SWR Obligatoria
Contactos y expedientes ya visitados se sirven desde caché SWR.
Sin re-fetch innecesario en cada montaje de componente.
Configuración lista para usar: `Optimizer.getContactoSWRConfig()`.

---

## Limitación Crítica (REGLA CISO — nunca violar)

**El Agente de Rendimiento NO puede desactivar AES-256 ni RLS para ganar velocidad.**
Si una query es lenta → solución: índices, paginación, caché. No eliminar controles de seguridad.

---

## Uso en Código

```typescript
import { Optimizer } from "@/agents/performance/Optimizer";

// Validar presupuesto de tiempo
Optimizer.assertBudget(measuredMs, "getContactos");

// Paginación cursor-based
const page = Optimizer.buildPrismaPage({ pageSize: 20, cursor: lastId });

// Caché SWR
const config = Optimizer.getContactoSWRConfig();
const listConfig = Optimizer.getListSWRConfig();

// Validar Google Maps
Optimizer.assertGoogleMapsLazy(componentPath);

// Certificado antes de producción
const checks = Optimizer.buildStandardChecks({ ... });
const cert = Optimizer.issueCertificate("modulo", checks);
```

---

## Optimización de Drive (Pendiente — Micro-Spec 3.1)

Los metadatos de Drive deben cachearse en BD (tabla `drive_documents`) para evitar
llamadas a la Drive API en cada render. Solo refrescar en background o a petición explícita.
