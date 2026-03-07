-- ============================================================================
-- 006_rgpd_hash_audit.sql — RGPD: AuditLog anonimizado + Entidades protegidas
--
-- @role: @Security-CISO / @Data-Architect
-- @spec: Micro-Spec RGPD — Derecho al Olvido + Veto de Entidades Matrices
--
-- CAMBIOS:
--   1. audit_logs: 4 campos nuevos para log FORGET sin PII
--      · hash_identificador — SHA-256(fiscal_id|tipo), indexado, sin nombre ni NIF
--      · base_legal         — texto de base legal del borrado
--      · meta_counts        — JSONB con conteo de registros destruidos
--      · purgeable          — permite un segundo borrado del propio log
--   2. contactos: 2 flags de protección permanente
--      · es_facturadora    — entidad de facturación (Lexconomy/Lawtech)
--      · es_entidad_activa — holding activa protegida
-- ============================================================================

-- ─── AuditLog: campos RGPD ───────────────────────────────────────────────────

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS hash_identificador TEXT,
  ADD COLUMN IF NOT EXISTS base_legal         TEXT,
  ADD COLUMN IF NOT EXISTS meta_counts        JSONB,
  ADD COLUMN IF NOT EXISTS purgeable          BOOLEAN NOT NULL DEFAULT false;

-- Índice para el Verificador de Borrado (buscar por hash sin escaneo completo)
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash
  ON audit_logs (hash_identificador)
  WHERE hash_identificador IS NOT NULL;

-- ─── Contactos: flags de entidad protegida ───────────────────────────────────

ALTER TABLE contactos
  ADD COLUMN IF NOT EXISTS es_facturadora    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_entidad_activa BOOLEAN NOT NULL DEFAULT false;
