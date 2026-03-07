-- ============================================================================
-- Migración 005: Agente Legal — Audit Logs + Cuarentena Legal
--
-- @author:  @Security-CISO / Agente Legal
-- @spec:    Micro-Spec 1.2 — Sistema de Auditoría Inmutable
-- @created: 2026-03-07
--
-- CAMBIOS:
--   1. Crea la tabla `audit_logs` (INMUTABLE por diseño — sin UPDATE / DELETE).
--   2. Actualiza el default de `quarantine_months` en `sociedades_holding`
--      de 48 → 60 meses (5 años — prescripción mercantil art. 30 CComercio
--      y art. 70 Ley 58/2003 General Tributaria).
--   3. Crea índices para consultas frecuentes de auditoría.
--
-- REGLA DE VETO:
--   Esta migración NO puede revertirse. Los AuditLogs son inmutables por
--   obligación legal. Una vez ejecutada, la tabla es de solo lectura.
--   Ninguna aplicación tendrá permisos de UPDATE o DELETE sobre ella.
-- ============================================================================

-- ─── 1. Tabla audit_logs (INMUTABLE) ─────────────────────────────────────────
--
-- Diseño deliberado:
--   · Sin FK a otras tablas (table_name + record_id son refs polimórficas).
--   · Sin campo updated_at — nunca se actualiza.
--   · Sin ON DELETE CASCADE — sobrevive a la eliminación del registro auditado.
--   · El acceso de escritura se limita al rol de aplicación; el DBA lo audita.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  table_name   TEXT        NOT NULL,
  record_id    TEXT        NOT NULL,
  action       TEXT        NOT NULL,    -- CREATE | READ | UPDATE | QUARANTINE | RESTORE | FORGET

  -- Contexto del actor (usuario o job de sistema)
  actor_id     TEXT,
  actor_email  TEXT,
  ip_address   TEXT,
  user_agent   TEXT,

  -- Snapshots antes y después de la mutación
  old_data     JSONB,
  new_data     JSONB,
  notes        TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_action_check
    CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'QUARANTINE', 'RESTORE', 'FORGET'))
);

COMMENT ON TABLE audit_logs IS
  'Registro de auditoría inmutable. PROHIBIDO UPDATE y DELETE sobre esta tabla. '
  'Referencia: RGPD Art. 5(2), art. 30 CComercio, Ley 58/2003 GILF.';

-- ─── 2. Índices de audit_logs ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

-- ─── 3. Política RLS — audit_logs ────────────────────────────────────────────
--
-- REGLA DE SEGURIDAD:
--   · La aplicación puede INSERT (escribir auditorías).
--   · La aplicación NO puede UPDATE ni DELETE (inmutabilidad garantizada).
--   · El rol `service_role` (Supabase) sí puede leer para informes DPO.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo INSERT permitido para el rol `anon` y `authenticated`
CREATE POLICY "audit_logs_insert_only"
  ON audit_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Lectura solo para service_role (DPO / Administrador)
-- El rol `authenticated` normal NO puede leer audit_logs directamente.
CREATE POLICY "audit_logs_read_service_role"
  ON audit_logs
  FOR SELECT
  TO service_role
  USING (true);

-- ─── 4. Ajustar quarantine_months default a 60 (5 años) ──────────────────────
--
-- Cambio de prescripción:
--   ANTES: 48 meses (4 años — art. 30 CComercio versión anterior)
--   AHORA: 60 meses (5 años — art. 70 Ley 58/2003 GILF + doctrina DGT)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sociedades_holding
  ALTER COLUMN quarantine_months SET DEFAULT 60;

-- Actualizar las sociedades existentes que tenían el default anterior (48)
-- para que adopten el nuevo mínimo legal (60). Solo afecta a las que tienen
-- exactamente 48 (el valor por defecto anterior), respetando configuraciones
-- personalizadas por encima del mínimo.
UPDATE sociedades_holding
  SET quarantine_months = 60
  WHERE quarantine_months = 48;

-- ─── 5. Enriquecer el campo quarantine_expires_at si es nulo ─────────────────
--
-- Los contactos en QUARANTINE sin fecha de expiración reciben ahora el
-- plazo por defecto (60 meses desde la fecha de creación del registro).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE contactos
  SET quarantine_expires_at =
    (created_at + INTERVAL '60 months')
  WHERE status = 'QUARANTINE'
    AND quarantine_expires_at IS NULL;

-- ─── 6. Comentarios de columnas clave ────────────────────────────────────────

COMMENT ON COLUMN contactos.quarantine_expires_at IS
  'Fecha de expiración de la cuarentena. '
  'Por defecto: created_at + 60 meses (5 años, art. 70 Ley 58/2003 GILF). '
  'Editable por el Administrador en SociedadHolding.quarantine_months.';

COMMENT ON COLUMN contactos.quarantine_reason IS
  'Motivo de la cuarentena. OBLIGATORIO cuando status = QUARANTINE. '
  'El Agente Legal rechaza transiciones a QUARANTINE sin este campo.';

COMMENT ON COLUMN sociedades_holding.quarantine_months IS
  'Meses de retención legal para este tenant. Default: 60 (5 años). '
  'Editable por el Administrador. No puede ser inferior a 36 (3 años mínimo legal).';
