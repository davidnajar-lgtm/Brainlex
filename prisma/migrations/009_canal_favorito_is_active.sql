-- ============================================================================
-- 009_canal_favorito_is_active.sql
--
-- @role: @Data-Architect
-- @spec: Ficha de Contacto — Fase 2: Pool de teléfonos + is_active comercial
--
-- CAMBIOS:
--   1. canales_comunicacion: añade subtipo (MOVIL/FIJO para tipo=TELEFONO)
--                            añade es_favorito (bool, sincroniza caché en contactos)
--   2. contactos: añade is_active (bool, toggle comercial INDEPENDIENTE del
--                 ciclo legal QUARANTINE/FORGOTTEN)
--
-- NOTAS:
--   - es_favorito=false y is_active=true son los defaults correctos para
--     los registros existentes (no rompe datos actuales).
--   - La sincronización de caché (telefono_movil/fijo en contactos) se gestiona
--     desde la capa de servicio, NO por trigger de BD.
-- ============================================================================

-- canales_comunicacion: subtipo + es_favorito
ALTER TABLE canales_comunicacion
  ADD COLUMN IF NOT EXISTS subtipo     TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS es_favorito BOOLEAN NOT NULL DEFAULT FALSE;

-- contactos: is_active
ALTER TABLE contactos
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Índice para filtrar contactos activos en el Directorio
CREATE INDEX IF NOT EXISTS idx_contactos_is_active ON contactos (is_active);
