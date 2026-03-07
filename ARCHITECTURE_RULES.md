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

## 4. Borrado de Datos — Soft Delete Obligatorio

- **Prohibido** el borrado físico (`DELETE`) de registros críticos (contactos, expedientes, facturas, documentos).
- Usar siempre `deleted_at` timestamp + `deleted_by` para auditoría.
- Excepción permitida: tablas de configuración temporal y sesiones.

## 5. RLS — Aislamiento Multi-Tenant

- Toda tabla debe tener `organization_id` y sus políticas RLS activas en Supabase.
- Ninguna query puede ejecutarse sin el contexto de tenant del usuario autenticado.

---

*Última actualización: 2026-03-06 — CTO Brainlex*
