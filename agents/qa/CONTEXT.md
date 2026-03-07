# CONTEXT.md — Agente de QA (The Auditor)

> Extraído de `docs/SSD_MASTER.md` y `docs/Source/micro specs.txt` sección 2.6.
> Define el proceso de certificación, los tests de regresión y los límites del Auditor.

---

## Specs de Referencia
- **Micro-Spec 2.6** — Protocolo de QA & Testing (transversal a todos los módulos)

---

## Protocolo de Colaboración QA (del SSD original)

> "Antes de finalizar cualquier módulo, el Agente Legal y el Agente de Datos
> deben emitir un certificado de Cumplimiento. El sistema no permitirá pasar
> a la siguiente fase sin una validación manual (UAT) satisfactoria."

---

## Proceso de Certificación Triple (obligatorio antes de merge)

```
1. Guardian.issueCertificate(module, contactoId) → APPROVED
2. Optimizer.issueCertificate(module, checks)    → APPROVED
3. Auditor.certifyModule(moduleName)              → APPROVED
   qa_status.json overall_status                 → APPROVED
```

Si cualquiera devuelve FAILED → el Orquestador NO puede cerrar la fase.

---

## Los 3 Checks de certifyModule()

### CHECK Q1 — I18N_COVERAGE
- El diccionario i18n debe cubrir ES · EN · FR sin claves vacías.
- Los valores EN y FR no pueden ser idénticos a ES (señal de no traducido).
- Todo módulo nuevo debe tener `lib/i18n/{modulo}.ts` antes de certificar.

### CHECK Q2 — TEST_SUITE
- `vitest run` debe terminar con 0 tests fallados.
- Los tests de regresión deben estar en `tests/regression/{modulo}.regression.test.ts`.
- TDD: el test se escribe ANTES que la lógica de negocio.

### CHECK Q3 — RESPONSIVE_DESIGN
- Los componentes TSX del módulo deben tener breakpoints Tailwind: `sm:`, `md:`, `lg:`.
- Sin breakpoints → CHECK FAILED → módulo no certifica.

---

## Criterios de Aceptación Trilingüe (ES / EN / FR)

> Fuente: `docs/Source/DOCUMENTO DE ESPECIFICACIONES TÉCNICAS Y FUNCIONALES.txt`
> El sistema es usado por clientes internacionales (80% de la base).
> **Ningún módulo puede ir a producción con strings en un solo idioma.**

### Estructura obligatoria del diccionario i18n

Cada módulo debe exportar su diccionario desde `lib/i18n/{modulo}.ts`:

```typescript
// Ejemplo: lib/i18n/contactos.ts
export const contactosLabels = {
  es: { /* Spanish — idioma base */ },
  en: { /* English — traducción real, no copia del español */ },
  fr: { /* Français — traducción real, no copia del español */ },
} as const;
```

### Tabla de Criterios de Aceptación por Idioma

| Criterio | ES (base) | EN | FR |
|----------|-----------|----|-----|
| Etiquetas de campo | Requeridas | Requeridas | Requeridas |
| Mensajes de error Zod | Requeridos | Requeridos | Requeridos |
| Textos de estado (ACTIVE, QUARANTINE…) | Requeridos | Requeridos | Requeridos |
| Confirmaciones de borrado / cuarentena | Requeridos | Requeridos | Requeridos |
| Tooltips y descripciones de ayuda | Requeridos | Requeridos | Requeridos |
| Notificaciones toast / banner | Requeridos | Requeridos | Requeridos |
| Emails automáticos del sistema | Requeridos | Requeridos | Requeridos |

### Claves que NO pueden estar vacías ni duplicadas

```typescript
// CHECK FAILED si cualquiera de estas condiciones se cumple:
labels.en.someKey === labels.es.someKey  // → no traducido
labels.fr.someKey === labels.es.someKey  // → no traducido
labels.en.someKey === ""                 // → clave vacía
labels.fr.someKey === ""                 // → clave vacía
Object.keys(labels.en).length !== Object.keys(labels.es).length  // → cobertura incompleta
```

### Módulos con i18n Implementado

| Módulo | Archivo | Estado |
|--------|---------|--------|
| Contactos | `lib/i18n/contactos.ts` | ✅ ES + EN + FR |

### Módulos con i18n Pendiente (bloquean certificación)

| Módulo | Archivo objetivo | Bloqueado por |
|--------|-----------------|---------------|
| Expedientes | `lib/i18n/expedientes.ts` | Micro-Spec 3.x pendiente |
| Facturación | `lib/i18n/facturacion.ts` | Micro-Spec 4.x pendiente |
| Blueprints | `lib/i18n/blueprints.ts` | Micro-Spec 5.x pendiente |
| Portal Cliente | `lib/i18n/portal.ts` | Micro-Spec 6.x pendiente |

---

## Tests de Regresión Existentes

| Archivo | Módulo | Cobertura |
|---------|--------|-----------|
| `tests/regression/contactos.regression.test.ts` | contactos | TaxonomyManager, Zod schema, i18n, integridad campos fijos |
| `lib/utils/normalizeAddress.test.ts` | utils | normalizeAddress (preposiciones, tildes, edge cases) |

---

## Tests Pendientes de Escribir (en orden de prioridad)

| Test | Spec | Descripción |
|------|------|-------------|
| `archiveContacto.test.ts` | Micro-Spec 1.2 | Verificar status QUARANTINE + quarantine_reason obligatorio |
| `legalAgent.test.ts` | Micro-Spec 1.2 | checkDependencies devuelve blocked=true con expedientes |
| `fiscalId.validation.test.ts` | Micro-Spec 2.6 | Algoritmo dígito de control DNI/NIE |
| `expediente.semaforo.test.ts` | Micro-Spec 4.2 | Semáforo Verde/Rojo + HTTP 412 |
| `blueprint.trigger.test.ts` | Micro-Spec 5.2 | Triggers de Blueprint por etiqueta SALI |

---

## Limitaciones de Seguridad del Auditor (INAMOVIBLES)

| Tipo | Regla |
|------|-------|
| PROHIBIDO | Modificar archivos fuera de `/tests/` y `qa_status.json` |
| PROHIBIDO | Importar módulos de negocio con efectos de escritura |
| PERMITIDO | Leer archivos de negocio para auditoría estática |
| PERMITIDO | Escribir en `tests/`, `tests/reports/`, `qa_status.json` |
| PERMITIDO | Escribir en `system_decision_log.md` |

El guard de seguridad `assertWriteAllowed()` en `Auditor.ts` está implementado en código.
Es imposible escribir fuera de los directorios permitidos sin lanzar un error explícito.

---

## Uso en Código

```typescript
import { Auditor } from "@/agents/qa/Auditor";

// Certificar un módulo completo
const cert = await Auditor.certifyModule("contactos");

// El Orquestador consulta si puede cerrar la fase
const canClose = Auditor.canClosePhase();
// → false si qa_status.json.overall_status !== "APPROVED"

// Leer estado actual
const status = Auditor.readStatus();
```

---

## Estado Actual de qa_status.json

Inicial: `overall_status: "PENDING"` — ningún módulo certificado aún.
Los primeros módulos a certificar cuando estén listos: `contactos`, `expedientes`.
