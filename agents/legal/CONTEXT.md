# CONTEXT.md — Agente Legal (Guardian)

> Extraído de `docs/SSD_MASTER.md` y `docs/Source/micro specs.txt`.
> Este archivo define exactamente qué debe saber y hacer el Agente Legal.
> Leer antes de cualquier operación de borrado, archivado o compliance.

---

## Spec de Referencia Principal
**Micro-Spec 1.2** — Middleware de Integridad y Cuarentena

---

## Función del Agente

El Agente Legal es un **middleware de validación jerárquica**. Actúa como
interceptor entre la UI y la base de datos para toda operación destructiva.
Su código reside en:
- `agents/legal/Guardian.ts` — fachada pública
- `lib/services/legalAgent.middleware.ts` — lógica de 3 fases

---

## Flujo de 3 Fases (INAMOVIBLE — no modificar sin aprobación CTO)

```
FASE 1 — Auditoría: checkDependencies(contactoId)
  Escanear: Expedientes | Documentos Drive | Facturas Holded

  ── Sin dependencias ──────────────────────────────────────
  CAMINO A: DELETE físico autorizado (doble confirmación en UI)

  ── Con dependencias ──────────────────────────────────────
  CAMINO B: HTTP 403 Forbidden
  FASE 2 — Bloqueo: Status → QUARANTINE
    · quarantine_reason OBLIGATORIO (mín. 5 caracteres)
    · Plazo: 4 años fiscal / 10 años AML / configurable por tenant
    · AuditLog escrito ANTES de mutar el estado (REGLA CISO)
  FASE 3 — Sujeto desaparece del Directorio Activo
```

---

## Reglas Hardcoded (imposible saltarse)

| Regla | Código |
|-------|--------|
| Ningún `prisma.contacto.delete()` directo | Siempre `Guardian.validateDelete()` |
| AuditLog antes de cualquier mutación | `writeAuditLog()` previo a toda mutación |
| `quarantine_reason` obligatorio | `BusinessValidationError` si vacío |
| AES-256 para contraseñas de certificados | No desactivar nunca por rendimiento |

---

## Funciones Pendientes de Implementar (Micro-Spec 1.2 / 1.3)

- `validateHojaEncargo(expedienteId)` — verificar firma digital antes de abrir Expediente ROJO
- `cryptoShred(contactoId)` — Derecho al Olvido: borrar PII pero conservar NIF + Razón Social
- `renewalAlert(certificateId)` — alerta de caducidad de certificados digitales
- Cron diario: revisión de `quarantine_expires_at` → notificación al Orquestador

---

## Plazos Legales de Cuarentena (Configurables por Tenant)

| Tipo de dato | Plazo | Fuente legal |
|---|---|---|
| Fiscal / Hacienda | 4 años | Art. 70 Ley 58/2003 |
| Mercantil | 5 años | Art. 30 Código de Comercio |
| Blanqueo de Capitales (AML) | 10 años | Ley 10/2010 |
| Default del sistema | 60 meses | `SociedadHolding.quarantine_months` |

---

## Limitaciones del Agente Legal (NO puede hacer)

- NO alterar lógica de precios, tarifas ni cálculos de facturación
- NO modificar el esquema de Prisma
- NO actuar sobre tablas que no sean Contacto, AuditLog, SociedadHolding
- Solo puede BLOQUEAR el flujo económico, nunca modificarlo

---

## Validaciones de Compliance Adicionales (Micro-Spec 2.x)

- Avisar si un expediente no tiene firma de Hoja de Encargo
- Avisar si el NIE/NIF de un sujeto ha expirado
- Controlar que documentos con datos sanitarios o económicos tengan checkbox RGPD vinculado al ID del sujeto
- Validar que consentimientos RGPD existen antes de subir documentación sensible

---

## Certificación de Módulo

Antes de pasar a producción, llamar:
```typescript
const cert = await Guardian.issueCertificate("modulo-nombre", contactoId);
// Requerido: cert.verdict === "APPROVED"
```
