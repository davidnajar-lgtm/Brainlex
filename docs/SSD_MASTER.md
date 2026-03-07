# SSD_MASTER.md — Especificación Maestra del Sistema BRAINLEX / LAWORK

> **Documento canónico de referencia.** Consolidado desde los 4 documentos fuente
> en `docs/Source/`. Leer al inicio de cada sesión de desarrollo.
> Fuentes originales: `Contexto_Negocio_BrainLex.txt`, `DOCUMENTO DE ESPECIFICACIONES
> TÉCNICAS Y FUNCIONALES.txt`, `ssd genérico.txt`, `micro specs.txt`.
> Última sincronización: 2026-03-07

---

## 1. CONTEXTO DE NEGOCIO

### Entidades del Grupo
| Entidad | Tenant | Actividad | Equipo |
|---------|--------|-----------|--------|
| **Lexconomy (LX)** | `LX` | Asesoría jurídica, mercantil, fiscal, extranjería, compliance AML | 12 personas |
| **Lawork (LW)** | `LW` | Gestión de movilidad laboral, PRL, CAE, construcción | 2 personas |

- Clientela 80% extranjera, 20% española.
- ~1.500 facturas anuales emitidas.
- 10-12 TB de documentación dispersa.
- Yo (el propietario) trabajo en ambas entidades.

### Los 6 Pains Principales (Prioridades de Desarrollo)

| # | Pain | Solución en el Sistema |
|---|------|------------------------|
| P1 | **Caos Documental** — 12 TB dispersos en Drive, A3, Sudespacho, WhatsApp, Email | Agente de Clasificación Silenciosa (OCR+NLP) + Taxonomía SALI |
| P2 | **Fuga de Facturación** — trabajos no facturados, suplidos perdidos | Zero Leakage Billing + Semáforo Verde/Rojo + Tracker de Actividad |
| P3 | **Pérdida de Plazos** — caducidad de certificados, hitos legales | Blueprints automatizados + alertas multi-canal |
| P4 | **Rechazo de Facturas** — clientes niegan pago por no haber recibido precio previo | Workflow de Aprobación: propuesta firmada antes de empezar |
| P5 | **Certificados Digitales** — petición y control de renovación complejo | Panel de certificados con alertas + AES-256 |
| P6 | **Sin seguimiento de leads/contactos** — exceso de trabajo impide respuesta rápida | Portal del pre-cliente + CRM ligero integrado en Directorio |

### Diccionario de Negocio

| Término | Definición |
|---------|-----------|
| **Sujeto** | Término unificador para Contacto + Cliente. La tabla es global (sin Company_ID). |
| **Cliente** | Sujeto al que se factura. Tiene expedientes y facturas en Holded. |
| **Contacto** | Sujeto relacionado (contrario, perito, notario, empleado de obra, proveedor). Puede convertirse en Cliente y viceversa sin perder datos ni documentos. |
| **Expediente** | Unidad mínima de trabajo y rentabilidad. Pertenece a un Company_ID (LX o LW). |
| **Blueprint** | Secuencia estandarizada de hitos y tareas. Motor de estado que orquesta el trabajo. |
| **Draft Zero** | Documento (contrato, demanda) generado automáticamente desde datos del sistema. |
| **SALI Tags** | Sistema de Autoclasificación Legal Inteligente. Taxonomía unificada de etiquetas. |
| **Suplido** | Gasto pagado por la empresa en nombre del cliente. Vinculación obligatoria a Expediente. |
| **Cuota** | Servicios recurrentes contratados (contabilidad, declaraciones). VERDE en el semáforo. |
| **Fuera de Cuota** | Servicio puntual no incluido en contrato. ROJO en el semáforo → requiere propuesta firmada. |

---

## 2. ARQUITECTURA TÉCNICA

### Stack Confirmado
- **Framework:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + Shadcn/UI, dark theme first
- **DB:** Supabase (PostgreSQL) + Prisma 7 con Driver Adapter
- **Auth:** Supabase Auth (SSR)
- **Storage:** Google Drive (abstraction layer — la WebApp es la interfaz, nunca Drive nativo)
- **Facturación:** Holded API (bidireccional — Holded es maestro contable, WebApp es maestro operativo)
- **Validación:** Zod
- **i18n:** ES · EN · FR desde la base (libphonenumber-js para teléfonos)
- **Firma electrónica:** API externa homologada (pendiente selección)
- **Cifrado:** AES-256 para contraseñas de certificados digitales

### Multi-Tenancy Híbrida
```
Tabla global (sin Company_ID):   Sujetos (Contactos/Clientes)
Tabla puente (con Company_ID):   ContactoCompanyLink, Expedientes, Facturas, Suplidos
Tabla de holding:                SociedadHolding (LX, LW, futuras empresas)
```
**Regla:** añadir "Empresa C" = un INSERT en SociedadHolding. Sin cambios de esquema.

### Reglas de Arquitectura Inamovibles
1. **No DELETE directo** sobre sujetos con historial. Siempre flujo de Cuarentena.
2. **AES-256** para contraseñas de certificados. Nunca desactivar por rendimiento.
3. **RLS activo** en todas las tablas. Nunca desactivar por optimización.
4. **Google Maps** solo con `next/dynamic + ssr:false` en componentes específicos.
5. **Banderas** solo con `country-flag-icons` (SVG). Prohibido PNG externos o emojis.
6. **Google Places** como fuente de verdad para direcciones (implementación: `PlacesAutocompleteInput.tsx`).
7. **IVA/Prorrata** zona vedada — no tocar sin aprobación CTO + revisión legal.

---

## 3. MÓDULOS DEL SISTEMA (Navegación)

```
Sidebar principal:
├── Panel de Control (dashboard usuario)
├── Mis Tareas
├── Explorador Drive
├── Directorio (Contactos + Clientes)
├── Listados (rentabilidad, empleados, clientes)
├── Subir Archivos
├── Generador de Docs (Draft Zero)
├── Auditoría (log histórico inalterable)
├── Portal del Usuario (cliente/empleado)
└── Administración
    ├── Personal (empleados, roles, tarifas)
    ├── Taxonomía (etiquetas SALI)
    ├── Sociedades (LX, LW, holding)
    ├── Carpetas (plantillas de directorios)
    ├── Blueprints (flujos estandarizados)
    └── Maestros (países, prefijos, cuentas contables)
```

---

## 4. FICHA DE SUJETO — CAMPOS POR PESTAÑA

### Pestaña Identidad
- Tipo: Persona Física (Nombre, Apellido1, Apellido2) | Persona Jurídica (Razón Social, Nombre Comercial)
- Código único auto-generado con identificador diferenciador cliente/contacto
- Estado: Activo / Inactivo / Pre-cliente
- ID Fiscal: NIF, CIF, NIE, DNI, Pasaporte, VAT, TIE, Registro Extranjero, Código Soporte, Sin Registro
- CNAE, IAE (numérico + descriptivo)
- Régimen IVA: General, Exento, Prorrata % (campo numérico si activo)
- Estado Censal AEAT (fecha última comprobación)
- Últimas Cuentas Anuales / Últimos Libros presentados

### Pestaña Comunicación
- Teléfonos (múltiples: Móvil, Fijo) con prefijo internacional
- Email principal (único) + canales adicionales
- Website URL, LinkedIn URL
- Canal preferido (Email | Móvil)

### Pestaña Economía / Fiscal
- IDs fiscales (desglosados arriba)
- Cuentas bancarias (SEPA/No-SEPA, Swift, número, banco, favorito)

### Pestaña Estructura (Visor Gráfico)
- Socios con % de participación
- Administradores (solidario, mancomunado, consejo) + representante persona física
- Empleados asignados
- Participadas
- **Roles LW:** Contratista, Subcontratista, Coordinador de Seguridad, Recurso Preventivo, empleados por obra
- Endpoint para visor gráfico de nodos (pendiente)

### Pestaña Certificados Digitales
- España / Otros países
- Fecha de expedición y caducidad
- Contraseña cifrada con AES-256
- Alertas de renovación

---

## 5. FLUJO DE BORRADO / CUARENTENA (VETO LEGAL — INAMOVIBLE)

```
Usuario pulsa "Borrar"
        ↓
FASE 1 — Auditoría: checkDependencies(sujetoId)
  · Expedientes (activos o cerrados)
  · Documentos en Drive
  · Facturas/Suplidos en Holded
        ↓
  ┌─── SIN dependencias ──────────────────────────────────────┐
  │  CAMINO A: Pop-up doble confirmación → DELETE físico      │
  └───────────────────────────────────────────────────────────┘
  ┌─── CON dependencias ──────────────────────────────────────┐
  │  CAMINO B: HTTP 403 Forbidden                             │
  │  → Botón "Borrar" deshabilitado                          │
  │  → Botón "Enviar a Cuarentena" activo                    │
  │  FASE 3: Status → QUARANTINE                             │
  │    · Quarantine_Reason OBLIGATORIO                        │
  │    · Plazo: 4 años (fiscal) / 6 años / 10 años (AML)     │
  │    · Sujeto desaparece del Directorio Activo              │
  │    · Solo visible en Admin > Papelera de Cuarentena       │
  └───────────────────────────────────────────────────────────┘
        ↓ (al cumplir el plazo)
FASE 4 — Derecho al Olvido:
  · Borrar: nombres, emails, teléfonos, dirección personal
  · MANTENER: NIF, Razón Social, registros de facturación
  · AuditLog ANTES de cualquier mutación (REGLA CISO)
```

---

## 6. MOTOR ECONÓMICO — ZERO LEAKAGE BILLING

### Semáforo de Servicio
- **VERDE (En Cuota):** tareas recurrentes definidas en contrato → permitir trabajo
- **ROJO (Fuera de Cuota):** servicio puntual → HTTP 412 Precondition Failed
  1. Bloquear edición del expediente
  2. Generar "Propuesta de Honorarios" (PDF con precio)
  3. Enviar al cliente para firma digital
  4. Solo liberar el expediente al recibir timestamp de firma aceptada

### Tracker de Actividad
- Detectar qué expedientes/documentos tiene abiertos el empleado
- Al cerrar → IA propone imputación de tiempo al Expediente
- "Bandeja de tareas no facturadas" — obligatoria antes del cierre de mes

### Suplidos
- Tabla `Suplidos`: vinculación obligatoria a ID_Expediente, Método_Pago, Estado_Recobro
- Panel admin: suplidos pagados no incluidos en ninguna factura

---

## 7. EXPEDIENTES Y BLUEPRINTS

### Anatomía del Expediente
- Responsable + equipo con permisos lectura/escritura
- Historial de actuaciones INALTERABLE (log de auditoría)
- Timeline gráfico de hitos (pasados y futuros)
- Visor de personas relacionadas (contactos vinculados al caso)
- Vinculación a Company_ID (LX o LW) para separación de rentabilidad
- Control económico: tiempo invertido vs facturado

### Motor de Blueprints
- **Triggers:** documento subido con etiqueta SALI dispara siguiente tarea
- **Asignación por rol:** Junior (recopilación) → Senior (revisión)
- **Condicional Legal:** Blueprint se detiene si falta requisito normativo (ej. Hoja de Encargo firmada)
- **Escalado:** alerta al Manager si deadline crítico va a expirar

### Módulo CAE/Movilidad (LW específico)
- Control de requisitos PRL por obra
- Alerta inmediata si empleado cambia de obra
- Bot/Script de sincronización con plataformas CAE externas

---

## 8. GESTIÓN DOCUMENTAL (SSOT)

### Drive como Backend Maestro
- Google Drive = repositorio físico
- WebApp = única interfaz de navegación (prohibida navegación nativa en Drive)
- Plantillas de carpetas automáticas al crear Sujeto/Expediente
- Legacy Bridge: vaciar progresivamente A3, Sudespacho, Drive antiguo

### Agente de Clasificación Silenciosa (OCR + NLP)
1. Entrada: Drag & Drop, WhatsApp, Email, escáner
2. IA lee el PDF → extrae NIF/CIF + tipo de documento
3. Sugiere: Nombre Unificado (`YYYY-MM-DD_NIF_NombreSujeto_V1.pdf`) + carpeta SALI
4. Usuario confirma con 1 clic (o arrastra a etiqueta)
5. Para datos sensibles (sanitarios, penales): procesado en servidor local antes de cloud

### Taxonomía SALI (Labels — solo Agente de Datos puede crear)
- Por Proceso: Facturado, Pendiente, En Cuarentena, URGENTE
- Por Tipo: Demanda, Notificación Judicial, Escritura, Contrato, Modelo Tributario
- Por Departamento: Mercantil, Procesal, Fiscal, Laboral (LW)

---

## 9. PORTALES

### Portal del Cliente
- Visor de timeline del expediente (fases del Blueprint)
- Panel "Dentro de Cuota" / presupuestos pendientes de aprobación
- Buzón documental seguro (subida + descarga de facturas/escrituras)
- Aprobación "One-Click": firma electrónica para propuestas, SEPA, RGPD

### Portal del Empleado
- Dashboard "Mis Tareas" ordenadas por deadline del Blueprint
- Chat interno enlazado al ID del Expediente (todas las decisiones quedan en bitácora)
- Gestor de Reuniones: grabación → transcripción → acta automática → Task List en Blueprint

### Panel de Administración
- Gráficos de rentabilidad: horas incurridas vs facturación (por empleado y por empresa)
- Gestión de tarifas por hora según rol
- Panel de Certificados Digitales con alertas de caducidad
- Omnicanalidad: WhatsApp Business API + Email → auto-asociar a Sujeto/Expediente

---

## 10. ESTADO DE IMPLEMENTACIÓN POR FASE

| Fase | Micro-Spec | Descripción | Estado |
|------|-----------|-------------|--------|
| 1 | 1.1 | Esquema Core + Multi-tenancy | COMPLETO |
| 1 | 1.2 | Middleware Cuarentena (Agente Legal) | COMPLETO |
| 1 | 1.3 | AES-256 + Crypto-shredding (Derecho al Olvido) | PENDIENTE |
| 2 | 2.1 | Validaciones Identidad + Fiscalidad | COMPLETO |
| 2 | 2.2 | Pestaña Estructura + Visor Gráfico | PARCIAL (campos en schema, visor pendiente) |
| 2 | 2.3 | Interfaz Edición Segura (Modo Edición inequívoco) | PENDIENTE |
| 2 | 2.4 | Ficha Ampliada del Contacto (dashboard 360) | EN PROGRESO |
| 2 | 2.5 | Validaciones Zod robustas + UX formulario | COMPLETO |
| 2 | 2.6 | Validación algoritmica DNI/NIE + VIES API | PENDIENTE |
| 3 | 3.1 | Drive como Backend + Taxonomía SALI | PENDIENTE |
| 3 | 3.2 | Agente Clasificación Silenciosa (OCR+NLP) | PENDIENTE |
| 3 | 3.3 | Draft Zero + Firma Electrónica | PENDIENTE |
| 4 | 4.1 | Tracker de Actividad + Imputación | PENDIENTE |
| 4 | 4.2 | Semáforo de Servicio (Zero Leakage) | PENDIENTE |
| 4 | 4.3 | Suplidos + Integración Holded | PENDIENTE |
| 5 | 5.1 | Anatomía Base del Expediente | PENDIENTE |
| 5 | 5.2 | Motor de Blueprints | PENDIENTE |
| 5 | 5.3 | Módulo CAE/Movilidad (LW) | PENDIENTE |
| 6 | 6.1 | Portal del Cliente | PENDIENTE |
| 6 | 6.2 | Portal del Empleado + Gestor Reuniones | PENDIENTE |
| 6 | 6.3 | Omnicanalidad (WhatsApp/Email) | PENDIENTE |
| 6 | 6.4 | Dashboard Administrativo | PENDIENTE |

**Siguiente paso inmediato:** Micro-Spec 2.4 — Ficha Ampliada del Contacto (en progreso)

---

## 11. REGLAS DEL PROCESO DE DESARROLLO (Vibe Coding Flow)

1. **Leer esta spec** antes de proponer cualquier plan.
2. **Consultar agente afectado** (ver AGENTS.md) y pedir Visto Bueno.
3. **TDD:** escribir test ANTES que la lógica de negocio.
4. **Implementar** siguiendo constraints de cada agente.
5. **Triple Certificación** antes de merge: Guardian + Optimizer + Auditor = APPROVED.
6. **Migraciones de BD** requieren aprobación explícita del Arquitecto Jefe.
7. **Ninguna migración** puede ejecutarse contra BD sin autorización.

---

## 12. FICHEROS DE GOBERNANZA

| Fichero | Propósito | Carga |
|---------|-----------|-------|
| `.claude/steering/product.md` | Business context, pains, diccionario | Automática |
| `.claude/steering/tech_and_architecture.md` | Stack, multi-tenancy, APIs | Automática |
| `.claude/steering/security_and_legal.md` | VETO LEGAL, cuarentena, AES-256 | Automática |
| `ARCHITECTURE_RULES.md` | Reglas técnicas inamovibles (IVA, banderas, Google Places) | Manual |
| `AGENTS.md` | Jerarquía de agentes, VETOs, protocolo | Manual |
| `agents/config.json` | Matriz de decisión completa | Manual |
| `docs/ROADMAP.md` | Estado detallado por micro-spec | Manual |
| `docs/SSD_MASTER.md` | **Este archivo** — spec maestra consolidada | Manual |
| `system_decision_log.md` | Log inmutable de decisiones de agentes | Auto (DecisionLogger) |
| `qa_status.json` | Estado de certificación QA por módulo | Auto (Auditor) |
