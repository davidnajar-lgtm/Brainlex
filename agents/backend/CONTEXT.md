# CONTEXT.md — Agente de Backend

> Extraído de `docs/SSD_MASTER.md` secciones 6 y 7, y `docs/Source/micro specs.txt`.
> Define las responsabilidades y límites del Agente de Backend.

---

## Specs de Referencia
- **Micro-Spec 4.1** — Tracker de Actividad e Imputación
- **Micro-Spec 4.2** — Semáforo de Servicio (Zero Leakage)
- **Micro-Spec 4.3** — Suplidos + Integración Holded
- **Micro-Spec 5.1** — Anatomía del Expediente
- **Micro-Spec 5.2** — Motor de Blueprints

---

## Módulos Bajo Responsabilidad del Backend

### Zero Leakage Billing (Micro-Spec 4.2) — PENDIENTE

El motor económico crítico. Evita que los clientes rechacen facturas.

```
Cuando se abre/edita un expediente:
  1. Comparar tarea con array Servicios_Contratados del cliente
  2a. VERDE (En Cuota) → permitir trabajo
  2b. ROJO (Fuera de Cuota):
      · HTTP 412 Precondition Failed
      · Bloquear edición del expediente
      · Disparar UI: "Generar Propuesta de Honorarios"
      · Generar PDF con precio → enviar al cliente para firma
      · Solo liberar expediente al recibir timestamp de firma aceptada
```

### Tracker de Actividad (Micro-Spec 4.1) — PENDIENTE
- Monitorizar qué expedientes/documentos tiene abiertos el empleado
- Al cerrar tarea: IA propone imputación al Expediente
- "Bandeja de tareas no facturadas" → obligatoria antes del cierre de mes

### Suplidos (Micro-Spec 4.3) — PENDIENTE
- Tabla `Suplidos`: campos obligatorios `ID_Expediente`, `Metodo_Pago`, `Estado_Recobro`
- NO se puede registrar un gasto sin vincularlo a un Sujeto o Expediente
- Panel admin: suplidos pagados no incluidos en ninguna factura

### Integración Holded (Micro-Spec 4.3) — PENDIENTE
- Holded = maestro contable | WebApp = maestro operativo
- Sincronización bidireccional: emitir facturas desde WebApp hacia Holded
- Leer de Holded: estado de cobro (Pagada/Pendiente) antes de nuevo trámite
- Separación automática de ingresos/gastos por Company_ID (LX vs LW)
- Centros de coste independientes dentro de la misma instancia

### Motor de Blueprints (Micro-Spec 5.2) — PENDIENTE
- Sistema de Triggers: documento con etiqueta SALI dispara siguiente tarea
- Asignación automática por rol del empleado (Junior recopilación / Senior revisión)
- Parada condicional si falta requisito legal (ej. Hoja de Encargo firmada)
- Escalado de alerta al Manager si deadline crítico va a expirar

### Expediente — Historial de Actuaciones (Micro-Spec 5.1) — PENDIENTE
- Log inalterable de cada acción, documento subido, correo enviado, decisión tomada
- Timeline gráfico de hitos pasados y futuros
- Rentabilidad: tiempo invertido vs facturación emitida

---

## Patrones Obligatorios

| Patrón | Regla |
|--------|-------|
| Repository Pattern | Toda consulta BD via repository, no Prisma directo en actions |
| Result Pattern | `{ ok: true; data } \| { ok: false; error }` — sin throws al cliente |
| Server Actions | Toda lógica de negocio en `"use server"`, nunca en client components |
| Zod before persist | Toda action valida con Zod antes de escribir en BD |
| $transaction | Operaciones multi-tabla siempre en `prisma.$transaction()` |

---

## Integraciones Externas (Responsabilidad del Backend)

| Sistema | Estado | Notas |
|---------|--------|-------|
| Holded API | PENDIENTE Micro-Spec 4.3 | Bidireccional — ~1.500 facturas/año |
| Google Drive API | PENDIENTE Micro-Spec 3.1 | Abstraction layer, nunca archivos en Supabase |
| Firma Electrónica | PENDIENTE Micro-Spec 3.3 | API externa homologada (pendiente selección) |
| WhatsApp Business API | PENDIENTE Micro-Spec 6.3 | Webhooks → auto-asociar a Sujeto/Expediente |
| OCR/NLP Motor | PENDIENTE Micro-Spec 3.2 | Clasificación silenciosa de documentos |
| Plataformas CAE | PENDIENTE Micro-Spec 5.3 | Bot/Script para LW (construcción) |

---

## Limitaciones del Agente de Backend (NO puede hacer)

- NO exponer lógica de negocio al cliente
- NO llamar a APIs externas desde Client Components
- NO saltarse la validación del Agente Legal para operaciones de borrado
- NO bloquear el cifrado AES-256 aunque mejore el rendimiento
- NO ejecutar migraciones de Prisma sin autorización del Arquitecto Jefe
