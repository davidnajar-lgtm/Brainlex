-- ============================================================================
-- 007_precliente_roles.sql — Pipeline comercial: flag es_precliente + índice de roles
--
-- @role: @Data-Architect
-- @spec: Micro-Spec 2.6 — Segmentación profesional del Directorio de Contactos
--
-- CAMBIOS:
--   1. contactos: nuevo flag es_precliente para el pipeline comercial
--   2. Índice compuesto (es_cliente, es_precliente, es_facturadora) para
--      optimizar el filtrado por pestañas en el Directorio
-- ============================================================================

ALTER TABLE contactos
  ADD COLUMN IF NOT EXISTS es_precliente BOOLEAN NOT NULL DEFAULT false;

-- Índice compuesto para filtrado instantáneo por roles
CREATE INDEX IF NOT EXISTS idx_contactos_roles
  ON contactos (es_cliente, es_precliente, es_facturadora);
