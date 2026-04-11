-- 046_source_health_control.sql
-- Source-health control plane: cooldown ramp + auto-disable.
--
-- Closes Codex review finding #10 (MEDIUM). Replaces the manual disable
-- path with a policy-driven control plane: exponential cooldown on
-- consecutive failures, automatic disable when a threshold is crossed,
-- admin-triggered reactivation via app/api/admin/sources/[id]/reactivate.
--
-- The TS source of truth for the eligibility filter, ramp, and
-- auto-disable predicate is lib/ingestion/source-policy.ts. The constants
-- below are mirrored in that file — bump one, bump the other.

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_disabled_reason TEXT;

-- Partial index that mirrors the eligibility filter — keeps the registry
-- query cheap as the table grows. We deliberately leave cooldown_until out
-- of the WHERE clause so the index entry is stable; the in-memory filter
-- in source-registry.ts handles the moving timestamp.
CREATE INDEX IF NOT EXISTS idx_sources_eligible
  ON sources (is_active, auto_disabled_at, cooldown_until)
  WHERE is_active = true AND auto_disabled_at IS NULL;

-- ---------------------------------------------------------------------------
-- increment_source_failure (extended)
-- ---------------------------------------------------------------------------
-- Replaces the original migration 036 implementation with a version that
-- atomically writes the cooldown_until and auto_disabled_* columns alongside
-- the consecutive_failures bump. The post-update RETURNING clause gives us
-- the new failure count and the lifetime success counter without a 2nd
-- read, which keeps the whole update single-row and lock-bounded.
--
-- Cooldown ramp: 2^min(consecutive, 8) minutes, capped at 240 (4h).
--   1→2m, 2→4m, 3→8m, 4→16m, 5→32m, 6→64m, 7→128m, 8+→240m.
--
-- Auto-disable: consecutive >= 10 AND lifetime success < 20. Shields
-- high-value sources that have been stable historically — they keep
-- climbing failures and surface in the dashboard for an operator to
-- decide.

CREATE OR REPLACE FUNCTION increment_source_failure(
  p_source_id UUID,
  p_status TEXT,
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_consecutive INTEGER;
  v_total_success INTEGER;
  v_cooldown_minutes INTEGER;
  v_should_disable BOOLEAN := false;
BEGIN
  -- COALESCE defends against legacy rows where consecutive_failures or
  -- total_articles_ingested might be NULL (migration 007 added the
  -- columns with DEFAULT 0 but no NOT NULL constraint). Without this,
  -- NULL + 1 = NULL and the function silently short-circuits.
  UPDATE sources
  SET
    last_fetch_at = now(),
    last_fetch_status = p_status,
    last_fetch_error = p_error,
    consecutive_failures = COALESCE(consecutive_failures, 0) + 1,
    updated_at = now()
  WHERE id = p_source_id
  RETURNING consecutive_failures, COALESCE(total_articles_ingested, 0)
  INTO v_consecutive, v_total_success;

  IF v_consecutive IS NULL THEN
    -- Source row vanished mid-update; nothing to do.
    RETURN;
  END IF;

  -- Cooldown ramp: 2^min(consecutive, 8) minutes, capped at 240 (4h).
  v_cooldown_minutes := LEAST(POWER(2, LEAST(v_consecutive, 8))::int, 240);

  -- Auto-disable threshold: 10 consecutive failures AND lifetime
  -- success count < 20.
  IF v_consecutive >= 10 AND v_total_success < 20 THEN
    v_should_disable := true;
  END IF;

  UPDATE sources
  SET
    cooldown_until = now() + make_interval(mins => v_cooldown_minutes),
    auto_disabled_at = CASE
      WHEN v_should_disable AND auto_disabled_at IS NULL THEN now()
      ELSE auto_disabled_at
    END,
    auto_disabled_reason = CASE
      WHEN v_should_disable AND auto_disabled_at IS NULL
        THEN 'Auto-disabled: ' || v_consecutive || ' consecutive failures'
      ELSE auto_disabled_reason
    END
  WHERE id = p_source_id;
END;
$$;

-- increment_source_success already clears consecutive_failures, which
-- naturally resets the cooldown ramp on the next failure. We do not need
-- to clear cooldown_until on success — the in-memory eligibility filter
-- treats a past cooldown as eligible, and the next failure overwrites
-- cooldown_until anyway.

-- ---------------------------------------------------------------------------
-- Lock down execute privileges
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE preserves existing GRANTs, but we re-apply the
-- REVOKE/GRANT pair defensively to keep this migration self-contained.

REVOKE ALL ON FUNCTION increment_source_failure(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_source_failure(UUID, TEXT, TEXT) TO service_role;
