-- ============================================================================
-- 008_fiscal_tipos_klm.sql — Nuevos tipos de NIF provisional español
--
-- @role: @Data-Architect
-- @spec: Fase 1 — Validación algorítmica de identificadores fiscales españoles
--
-- CAMBIOS:
--   1. FiscalIdTipo: añade K (menor español), L (español en extranjero),
--      M (extranjero sin NIE con intereses económicos en España)
--
-- BASE LEGAL:
--   Artículo 19.2 RGAT — NIF K y L para españoles sin DNI
--   Artículo 20 RGAT — NIF M para extranjeros sin NIE
--   Orden EHA/451/2008 — Composición del NIF de personas jurídicas
-- ============================================================================

-- PostgreSQL no permite ADD VALUE dentro de una transacción explícita.
-- Estas instrucciones deben ejecutarse fuera de BEGIN/COMMIT.

ALTER TYPE "FiscalIdTipo" ADD VALUE IF NOT EXISTS 'K';
ALTER TYPE "FiscalIdTipo" ADD VALUE IF NOT EXISTS 'L';
ALTER TYPE "FiscalIdTipo" ADD VALUE IF NOT EXISTS 'M';
