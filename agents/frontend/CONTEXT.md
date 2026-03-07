# CONTEXT.md — Agente de Frontend (UX)

> Extraído de `docs/SSD_MASTER.md` secciones 2, 4 y `docs/Source/micro specs.txt`.
> Define las reglas de interfaz, i18n y UX que el Frontend debe cumplir siempre.

---

## Specs de Referencia
- **Micro-Spec 2.3** — Interfaz de Edición Segura (Modo Edición inequívoco)
- **Micro-Spec 6.1** — Portal del Cliente
- **Micro-Spec 6.2** — Portal del Empleado y Gestor de Reuniones
- **Micro-Spec 6.3** — Omnicanalidad (WhatsApp/Email)
- **Micro-Spec 6.4** — Dashboard Administrativo

---

## Reglas de i18n (HARD — detectado por The Auditor)

- **Todo texto visible al usuario** debe obtenerse de `getContactosLabels(locale)` o equivalente.
- Prohibido hardcodear strings en ES, EN o FR directamente en componentes TSX.
- Ficheros de diccionario: `lib/i18n/{modulo}.ts` con los 3 locales.
- El fallback siempre es ES si el locale no se encuentra.
- El Portal del Cliente cambia dinámicamente según preferencia del Sujeto.

---

## Modo Edición Inequívoco (Micro-Spec 2.3 — PENDIENTE)

Las fichas de Sujeto son **solo lectura por defecto**.

```
Estado lectura: UI normal
Al clicar "Editar":
  · Borde del layout cambia a color inequívoco (ej. amber-500)
  · Banner visible: "MODO EDICIÓN ACTIVO"
  · Objetivo: prevenir cambios accidentales en datos de clientes
```

---

## Reglas de UI (Inamovibles)

| Regla | Detalle |
|-------|---------|
| Dark theme first | Background `#0d0d0d`. No light mode sin petición explícita |
| Shadcn/UI | Sistema de componentes obligatorio. No inventar UI desde cero |
| Banderas | Solo `country-flag-icons` (SVG). Prohibido PNG externos o flag emojis |
| Teléfonos | `libphonenumber-js` + prefijo internacional. Formato E.164 |
| Google Maps | Solo `next/dynamic + ssr:false` en componentes específicos. NUNCA global |
| Responsivo | Todo componente TSX debe tener `sm:`, `md:`, `lg:` (verificado por Auditor) |
| Error Boundaries | Cada sección crítica necesita su propio boundary |

---

## Navegación del Sistema (Sidebar)

Estructura de menú confirmada en `docs/SSD_MASTER.md` sección 3:
```
Panel de Control · Mis Tareas · Explorador Drive · Directorio
Listados · Subir Archivos · Generador de Docs · Auditoría
Portal del Usuario · Administración
```

---

## Portales (Pendiente — Micro-Spec 6.x)

### Portal del Cliente (Micro-Spec 6.1)
- Visor de timeline del expediente (fases del Blueprint)
- Panel "Dentro de Cuota" / presupuestos pendientes
- Buzón documental seguro
- Aprobación "One-Click" para propuestas, SEPA, RGPD

### Portal del Empleado (Micro-Spec 6.2)
- Dashboard "Mis Tareas" ordenadas por deadline
- Chat interno enlazado al ID del Expediente
- Gestor de Reuniones: grabación → transcripción → Task List automática

---

## Drag & Drop (Pendiente)

- Drag & Drop global para subida de documentos
- Si el usuario arrastra un archivo sobre un Blueprint, preguntar si es el trigger del primer hito
- Arrastrar etiquetas sobre documentos/contactos/expedientes (bidireccional)

---

## Limitaciones del Agente de Frontend (NO puede hacer)

- NO añadir lógica de negocio en Client Components
- NO llamar a APIs externas directamente desde el cliente
- NO cargar Google Maps de forma global o en layouts
- NO hardcodear textos (detectado por `Auditor.certifyModule()` — CHECK I18N)
- NO añadir animaciones/gráficos que degraden el scroll a < 60fps (VETO Optimizer)
- NO ignorar los breakpoints de Tailwind (sm:, md:, lg:) en nuevos componentes

---

## Dependencia con el Agente de Rendimiento

El Frontend recibe VETOs del Optimizer sobre:
- TTI > 200ms → VETO
- Listas sin paginación → VETO
- Maps global → VETO
- Sin caché SWR → advertencia
- Animaciones pesadas sin lazy loading → VETO
