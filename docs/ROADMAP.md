# BRAINLEX ERP — Roadmap & Estado del Proyecto

> **Documento vivo.** Actualizar al cierre de cada sesión de desarrollo.
> Última actualización: 2026-03-06 (Micro-Spec 2.5 — Fase Contactos COMPLETADA)

---

## 🟢 HECHO (Completado)

### Infraestructura & Setup
- [x] **Next.js 15** + TypeScript + Tailwind CSS + Shadcn/UI inicializados
- [x] **Supabase** conectado (PostgreSQL) — conexión verificada en producción
- [x] **Prisma 7** con Driver Adapter `@prisma/adapter-pg` (requerido por Prisma 7, sin URL en schema)
- [x] Singleton `lib/prisma.ts` con patrón `globalForPrisma` para hot-reload seguro

### App Shell
- [x] Layout raíz: Sidebar fijo + Topbar + área de contenido scrollable (`app/layout.tsx`)
- [x] **Sidebar** con navegación principal (Contactos, Expedientes, Facturación…)
- [x] **Topbar** con selector de tenant (Lexconomy SL) y campana de notificaciones

### Reloj Mundial Dinámico
- [x] `WorldClock` Client Component — hidratación segura (`useState<Date|null>(null)`)
- [x] Fuente completa de zonas horarias via `Intl.supportedValuesOf('timeZone')` (~600 zonas, sin arrays hardcodeados)
- [x] Combobox con búsqueda en tiempo real, chips de zonas fijadas, `font-mono tabular-nums`
- [x] Persistencia en `localStorage` — sobrevive a F5 sin race condition de effects

### Directorio de Contactos (Micro-Spec 2.2 / 2.3 / 2.4)
- [x] **Migración de Sujetos → Contactos**: modelo `Contacto` (PF/PJ), `ContactoStatus` (ACTIVE / QUARANTINE / FORGOTTEN), `ContactoCompanyLink` multitenant
- [x] Schema Prisma: `SociedadHolding`, `Contacto`, `ContactoCompanyLink`, `Expediente`, `AuditLog` inmutable
- [x] Arquitectura DDD completa: Repositorio → Servicio → Action (controlador delgado)
- [x] **Listado** con tabla, badges de estado/tipo, Empty State, Error State (`app/contactos/page.tsx`)
- [x] **Alta de Contacto** — formulario cliente con validación manual (`app/contactos/nuevo/page.tsx`)
- [x] **Edición de Contacto** — ruta `app/contactos/[id]/editar/`, formulario pre-rellenado
- [x] **Soft Delete (Archivado)** — `ArchiveButton` con `window.confirm` → `archiveContacto()` → `QUARANTINE`

### Política de Borrado GDPR (VETO LEGAL)
- [x] `archive()` en repositorio: única vía de borrado desde UI → transición a `QUARANTINE`
- [x] `dangerouslyHardDeleteForGdprComplianceOnly()`: renombrado, JSDoc con requisitos DPO + Art. 17 RGPD
- [x] `contactoService.deleteContacto()`: único caller autorizado del hard delete, con auditoría previa
- [x] `findAll()` filtra por `status: ACTIVE` — QUARANTINE y FORGOTTEN invisibles por defecto
- [x] `AuditEntry.old_data / new_data` tipados como `Prisma.InputJsonValue` (0 errores TypeScript)

### Micro-Spec 2.5 — Validaciones Robustas con Zod ✅ COMPLETO
- [x] `lib/validations/contacto.schema.ts` — schema Zod con `superRefine` condicional
- [x] Validación estructural de DNI (8d+L), NIE (X/Y/Z+7d+L), CIF (letra+7d+control), NIF (umbrella)
- [x] Validación de VAT europeo: prefijo ISO 3166-1 alpha-2 + 2-12 alfanuméricos
- [x] `createContacto` y `updateContacto` usan `safeParse` — devuelven `fieldErrors` por campo
- [x] Errores inline en rojo (`text-red-500`) bajo cada `<input>` en formulario de alta y edición
- [x] Bordes de campo en error: `border-red-600/60` con ring rojo al focus
- [x] Migración a Zod 4 API: `z.enum(obj)`, `"custom"` literals, `.email({ error })`, `React.SyntheticEvent`
- [x] **Prefijos telefónicos UI**: `CustomPhoneInput` con FlagCDN + selector Móvil/Fijo, `defaultCountry="ES"`, skin Zinc oscuro
- [x] **Formato Legal de Nombres (MAYÚSCULAS)**: transform Zod `.toUpperCase()` en `nombre`, `apellido1`, `apellido2` y `razon_social`
- [x] **Integridad de datos**: `@unique` en `email` y `@@unique([fiscal_id, fiscal_id_tipo])` — captura P2002 con mensaje legible
- [x] **Lógica de borrado híbrida**: Hard Delete (modal custom, sin `window.confirm`) para contactos limpios + Soft Delete (QUARANTINE) si tiene expedientes
- [x] **Tipo de Sociedad**: `SociedadCombobox` buscable con diccionario internacional (30 tipos: España, UK/USA, Europa); validación condicional solo para PJ
- [x] **Campo Notas libres**: `notas String?` en schema + Zod + UI (`<textarea rows={4}`, `resize-none`)
- [x] **Data Grid mejorado**: columnas Email + Teléfono visibles en desktop; acción "Ver Ficha" con icono ojo → `/contactos/[id]`
- [x] **Ficha Ampliada scaffold**: `app/contactos/[id]/page.tsx` — RSC con `notFound()`, header, 3 cards placeholder, muestra `notas`

---

## ✅ DECISIONES ARQUITECTÓNICAS CONSOLIDADAS (Contactos)

> Registradas al cierre de Micro-Spec 2.5 para preservar contexto entre sesiones.

### 1. UI de Teléfonos — FlagCDN + Selector Móvil/Fijo
- **Problema**: Unicode flag emojis no renderizan en Windows 10/11; `<select>` nativo ignora dark mode.
- **Solución**: `CustomPhoneInput` totalmente custom. Banderas via `https://flagcdn.com/w20/{code}.png`. Dropdown propio con búsqueda (query filtra nombre, código ISO y prefijo). Selector binario Móvil/Fijo como toggle segmentado.
- **Archivos**: `app/contactos/CustomPhoneInput.tsx`

### 2. Integridad de Datos — @unique + P2002
- **Regla**: `email` es `@unique` (NULL no viola la restricción en PostgreSQL). `fiscal_id + fiscal_id_tipo` tienen `@@unique` compuesto.
- **Captura**: `createContacto` y `updateContacto` atrapan `Prisma.PrismaClientKnownRequestError` con `err.code === "P2002"` y mapean `err.meta?.target` a mensajes legibles en español.
- **Archivos**: `prisma/schema.prisma`, `lib/actions/contactos.actions.ts` (`p2002Message()`)

### 3. Lógica de Borrado Híbrida — Hard Delete vs Cuarentena
- **Flujo**: `deleteContacto()` comprueba `_count.expedientes`. Si > 0 → error bloqueante con instrucción de archivar. Si = 0 → `$transaction([deleteMany(links), delete(contacto)])`.
- **Soft Delete**: `archiveContacto()` → `status: QUARANTINE` con `quarantine_reason` y plazo de 48 meses (art. 30 CComercio).
- **UI**: Modal custom (`fixed inset-0 z-50`) con dos CTAs claros: "Eliminar" (rojo) + "Archivar" (naranja). Sin `window.confirm`.
- **Archivos**: `app/contactos/DeleteButton.tsx`, `lib/actions/contactos.actions.ts`, `lib/repositories/contacto.repository.ts`

### 4. Entidades Jurídicas — Combobox Internacional + Zod Condicional
- **Combobox**: `SociedadCombobox` con 30 tipos internacionales (S.L., LLC, GmbH, SARL, B.V., etc.) en `lib/constants/sociedades.ts`. Buscable, `onMouseDown` para evitar race condition blur/click, `Enter` bloqueado para evitar submit fantasma.
- **Validación Zod**: `superRefine` exige `razon_social` + `tipo_sociedad` solo cuando `tipo === PERSONA_JURIDICA`. Whitelist separada de `fiscal_id_tipo` para PF vs PJ (CIF solo disponible para PJ).
- **Archivos**: `app/contactos/SociedadCombobox.tsx`, `lib/constants/sociedades.ts`, `lib/validations/contacto.schema.ts`

### 5. Campo Notas + Acceso a Ficha Ampliada
- **Notas**: `notas String?` añadido al schema y regenerado con `prisma db push` + `prisma generate`. Flujo completo: schema → Zod → DTO → Action → UI (`<textarea rows={4} resize-none>`). Visible en Ficha Ampliada si tiene contenido.
- **Ver Ficha**: Botón con icono ojo en el data grid (visible on hover, `opacity-0 group-hover:opacity-100`) apunta a `/contactos/${id}`. RSC destino: `app/contactos/[id]/page.tsx` con `notFound()` guard, header con nombre/tipo/NIF, botón Editar, y 3 cards placeholder (Expedientes, Documentos, Facturación).
- **Archivos**: `app/contactos/page.tsx`, `app/contactos/[id]/page.tsx`

---

## 🟡 EN PROGRESO

### Micro-Spec 2.6 — Ficha Ampliada del Contacto (Dashboard del Cliente)
- [x] Scaffold de ruta `/contactos/[id]` — RSC básico con header y placeholders
- [x] **Pestañas de navegación**: 6 tabs (Visión · Filiación · Operativa · Admin · Ecosistema · Bóveda)
- [x] **Pestaña Filiación y Canales**: identidad, canales directos, CRUD Direcciones, CRUD Canales
- [x] **Pestaña Operativa**: lista de expedientes vinculados con contador, semáforo Zero Leakage
- [x] **Pestaña Administración**: ciclo de vida, estado QUARANTINE, botón Restaurar, AuditLog inmutable
- [x] `restoreContacto()` Server Action: QUARANTINE → ACTIVE con AuditLog(RESTORE) previo (REGLA CISO)
- [x] `restore()` + `findAuditLogs()` en repositorio
- [ ] **Pestaña Visión General**: resumen ejecutivo con KPIs y actividad reciente
- [ ] **Pestaña Ecosistema**: relaciones, socios, participadas (requiere Micro-Spec 2.2 completa)
- [ ] **Pestaña La Bóveda**: documentos privados (requiere Micro-Spec 3.x Drive)

### Tests pendientes (Micro-Spec 2.4 / 2.5)
- [ ] **Test E2E** del flujo completo: editar → guardar → confirmar revalidación
- [ ] **Test unitario** de `archiveContacto` — verificar que `status` cambia a `QUARANTINE`

---

## 🔴 PENDIENTE (Próximas Micro-Specs)

### Micro-Spec 2.5 (parcial) — Validación pendiente
- [ ] Algoritmo de dígito de control para DNI/NIE (validación algorítmica, no solo estructural)
- [ ] **Integrar API oficial del VIES europeo** para validación real de VAT Numbers en el módulo de Compliance

### Micro-Spec 3.x — Expedientes & Facturación
- [ ] CRUD de Expedientes (`/expedientes`)
- [ ] Asignación de Contacto principal a Expediente
- [ ] Semáforo Zero Leakage: `fuera_de_cuota` + `propuesta_firmada_at`
- [ ] Integración con Holded (sincronización de facturas)

### Micro-Spec 4.x — Autenticación & Multi-tenancy
- [ ] Login / Logout con Supabase Auth (SSR)
- [ ] Middleware de protección de rutas (`middleware.ts`)
- [ ] Selector de tenant funcional (ahora es UI estática)
- [ ] RLS en todas las tablas de Supabase

### Micro-Spec 5.x — Integración Google Drive
- [ ] Capa de abstracción `DriveService`
- [ ] Adjuntar documentos a Expedientes (sin almacenar binarios en Supabase)
- [ ] Visor de documentos en la Vista 360

---

## 🚀 CHECKLIST DE PRODUCCIÓN

### Seguridad
- [ ] **Autenticación activa** — Supabase Auth configurado y middleware protegiendo todas las rutas dashboard
- [ ] **RLS habilitado** en todas las tablas (verificar con `supabase db lint`)
- [ ] **Variables de entorno** — `.env.local` no subido a git; `.env.production` en Vercel/servidor
- [ ] `DATABASE_URL` y `DIRECT_URL` apuntan a pool de producción (PgBouncer en Supabase)
- [ ] **AES-256** configurado para cifrado de contraseñas de Certificados Digitales
- [ ] Rate limiting en Server Actions críticos (Upstash o Vercel Edge Config)
- [ ] Headers de seguridad en `next.config.ts` (CSP, HSTS, X-Frame-Options)

### Calidad de Código
- [ ] **0 errores TypeScript** (`npx tsc --noEmit`) — actualmente cumplido
- [ ] Eliminar todos los `console.log` y `console.error` de producción (usar logger estructurado)
- [ ] Revisión de `TODO` y `FIXME` pendientes en el código
- [ ] Tests unitarios para lógica de negocio crítica (VETO LEGAL, validaciones Zod)

### Infraestructura
- [ ] **Backups automáticos** de Supabase activados (mín. diario con retención 7 días)
- [ ] Plan de recuperación ante desastres documentado
- [ ] Monitoreo de errores configurado (Sentry o similar)
- [ ] Alertas de uptime configuradas

### Legal & Compliance
- [ ] Política de Privacidad y Aviso Legal publicados y accesibles
- [ ] Registro de Actividades de Tratamiento (RAT) actualizado con este sistema
- [ ] Flujo de ejercicio de Derechos RGPD documentado (Acceso, Rectificación, Supresión, Portabilidad)
- [ ] DPO designado y contacto publicado en la aplicación
- [ ] Proceso formal de autorización para `dangerouslyHardDeleteForGdprComplianceOnly()` documentado

### Pre-lanzamiento
- [ ] Pruebas de carga (simular 14 usuarios concurrentes)
- [ ] Revisión de accesibilidad WCAG 2.1 AA en componentes críticos
- [ ] Demo con el equipo completo (14 personas) y recogida de feedback
- [ ] Plan de rollback documentado en caso de fallo crítico en producción
