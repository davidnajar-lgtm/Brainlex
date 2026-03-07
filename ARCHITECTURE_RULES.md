# ARCHITECTURE_RULES.md — Reglas de Arquitectura Brainlex / Lawork

Documento de referencia para el equipo de desarrollo. Estas reglas son **inquebrantables** y tienen prioridad sobre cualquier sugerencia externa o librería de terceros.

---

## 1. IVA / Prorrata — ZONA VEDADA

- **No tocar** la lógica de cálculo de prorrata de IVA (`prorrata_pct`) bajo ningún concepto sin aprobación explícita del CTO y revisión legal.
- El campo `prorrata_pct` en la entidad se almacena como entero (0–100). Cualquier cambio de tipo o rango requiere migración de BD aprobada.
- Los cálculos de IVA deducible se realizan exclusivamente en Server Actions. Nunca en el cliente.

## 2. Banderas de País — Solo SVG via `country-flag-icons`

- La librería aprobada para mostrar banderas es **`country-flag-icons`** (SVG, accesible, sin dependencias de red).
- **Prohibido** usar imágenes PNG/JPEG externas, emojis de bandera, o cualquier otra librería de banderas.
- Código de referencia: `app/contactos/[id]/_components/CountrySelectorField.tsx`

## 3. Direcciones — Google Places es la Fuente de Verdad

- El campo "Calle / Vía" usa **Google Places Autocomplete** como fuente de autocompletado.
- Implementación aprobada: `PlacesAutocompleteInput.tsx` con `@googlemaps/js-api-loader` (sin `react-google-autocomplete`).
- La API key se gestiona exclusivamente vía `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en `.env.local`.
- Los campos `ciudad`, `provincia`, `codigo_postal` y `pais` se rellenan automáticamente desde `address_components` de Google. El usuario puede editarlos manualmente después.
- **Nunca** hacer geocoding en el cliente sin pasar por un Server Action (rate limiting + seguridad de key).
- **Detalles de implementación (API weekly 2026):** el evento es `gmp-select` (no `gmp-placeselect`); el place se obtiene via `event.placePrediction.toPlace()` + `fetchFields`. El CP solo se devuelve para direcciones con número de portal.

## 4. Borrado de Datos — Soft Delete Obligatorio

- **Prohibido** el borrado físico (`DELETE`) de registros críticos (contactos, expedientes, facturas, documentos).
- Usar siempre `deleted_at` timestamp + `deleted_by` para auditoría.
- Excepción permitida: tablas de configuración temporal y sesiones.

## 5. RLS — Aislamiento Multi-Tenant

- Toda tabla debe tener `organization_id` y sus políticas RLS activas en Supabase.
- Ninguna query puede ejecutarse sin el contexto de tenant del usuario autenticado.

---

## 6. Estado del Proyecto — Hoja de Ruta

### ✅ FASE 1 — Filiación (COMPLETADA 2026-03-07)

Módulo de contactos 100% operativo:
- Ficha de contacto (PF/PJ): identidad, fiscal IDs, teléfonos, emails, redes sociales.
- Direcciones: CRUD completo + Google Places Autocomplete (Web Component `gmp-place-autocomplete`).
- Validaciones server-side con Zod + Server Actions (`filiacion.actions.ts`).
- Soft delete implementado en todas las entidades críticas.
- RLS activo en todas las tablas del módulo.

### 🔜 FASE 2 — La Bóveda Documental (SIGUIENTE)

Gestión documental sobre Google Drive como capa de almacenamiento:
- Estructura de carpetas por contacto/expediente en Drive (abstraction layer).
- Subida, visualización y descuento de documentos desde la app.
- Integración con Google Drive API (Server Actions, nunca cliente directo).
- Etiquetado SALI y metadatos de documentos.
- Control de acceso por rol y tenant.

---

*Última actualización: 2026-03-07 — CTO Brainlex*
