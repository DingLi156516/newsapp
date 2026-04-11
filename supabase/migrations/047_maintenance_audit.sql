-- 047_maintenance_audit.sql
-- Audit log for operator-driven pipeline maintenance.
--
-- Closes Codex review finding #11 (MEDIUM). Migrations 025 and 026 ran
-- destructive backlog cleanups in schema history; future cleanups must
-- go through the operator tool at /admin/pipeline → Maintenance panel
-- and POST /api/admin/maintenance. This table is the audit log those
-- calls write to — every dry-run and every real run is recorded, even
-- when zero rows would be affected.
--
-- Schema history stays additive from here. If another cleanup ships as
-- a migration after this one, the code reviewer should push back and
-- ask for the operator-tool path instead.

CREATE TABLE IF NOT EXISTS pipeline_maintenance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL
    CHECK (action IN (
      'purge_unembedded_articles',
      'purge_orphan_stories',
      'purge_expired_articles'
    )),
  dry_run BOOLEAN NOT NULL,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_count INTEGER,
  sample_ids TEXT[],
  error TEXT,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_maintenance_audit_triggered_at
  ON pipeline_maintenance_audit (triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_maintenance_audit_action
  ON pipeline_maintenance_audit (action, triggered_at DESC);

-- Row-level security: only service_role writes; admins read via the
-- API route which runs under the service client. No direct anon or
-- authenticated access.
ALTER TABLE pipeline_maintenance_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_maintenance_audit_service_role_all"
  ON pipeline_maintenance_audit;
CREATE POLICY "pipeline_maintenance_audit_service_role_all"
  ON pipeline_maintenance_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Atomic purge helper functions
-- ---------------------------------------------------------------------------
-- Each helper runs as a single SECURITY DEFINER function that returns
-- the affected ids. The TS wrappers in lib/admin/pipeline-maintenance.ts
-- pass dry_run + limit + options and use the returned ids as both the
-- delete count and the audit sample. Running the entire delete inside
-- one function statement closes the TOCTOU race where a concurrent
-- pipeline write could invalidate the select phase of a two-round-trip
-- select-then-delete.

-- Unembedded purge: candidate CTE takes row locks via FOR UPDATE SKIP
-- LOCKED so concurrent embed/cluster writers either wait or skip the
-- row entirely. The outer DELETE re-asserts the mutable predicate
-- (`is_embedded = false AND created_at < cutoff`) as a belt-and-
-- suspenders guard: even if somehow the candidate row was mutated
-- between the CTE's snapshot and the DELETE's write, a row that no
-- longer matches is not deleted.
CREATE OR REPLACE FUNCTION purge_unembedded_articles_batch(
  p_older_than_days INTEGER,
  p_limit INTEGER,
  p_dry_run BOOLEAN
)
RETURNS TABLE (deleted_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - make_interval(days => p_older_than_days);
BEGIN
  IF p_dry_run THEN
    RETURN QUERY
      SELECT a.id
      FROM articles a
      WHERE a.is_embedded = false
        AND a.created_at < v_cutoff
      ORDER BY a.created_at
      LIMIT p_limit;
  ELSE
    RETURN QUERY
      WITH candidates AS (
        SELECT id
        FROM articles
        WHERE is_embedded = false
          AND created_at < v_cutoff
        ORDER BY created_at
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM articles a
      USING candidates c
      WHERE a.id = c.id
        AND a.is_embedded = false
        AND a.created_at < v_cutoff
      RETURNING a.id;
  END IF;
END;
$$;

-- Expired purge: `clustering_status = 'expired'` is a terminal state
-- so the race window is already narrow. FOR UPDATE SKIP LOCKED still
-- adds defense in depth in case the expiry transition ever becomes
-- reversible. The outer DELETE re-asserts the predicate identically.
CREATE OR REPLACE FUNCTION purge_expired_articles_batch(
  p_limit INTEGER,
  p_dry_run BOOLEAN
)
RETURNS TABLE (deleted_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_dry_run THEN
    RETURN QUERY
      SELECT a.id
      FROM articles a
      WHERE a.clustering_status = 'expired'
      LIMIT p_limit;
  ELSE
    RETURN QUERY
      WITH candidates AS (
        SELECT id
        FROM articles
        WHERE clustering_status = 'expired'
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM articles a
      USING candidates c
      WHERE a.id = c.id
        AND a.clustering_status = 'expired'
      RETURNING a.id;
  END IF;
END;
$$;

-- Orphan purge: the hazardous case. Uses a brief `LOCK TABLE articles
-- IN SHARE MODE` inside the function to block concurrent article
-- inserts for the duration of the DELETE. Without this lock, a new
-- article with story_id pointing at a to-be-deleted story could land
-- between the NOT EXISTS evaluation and the DELETE commit; the FK is
-- `ON DELETE SET NULL`, so the new article would be silently detached.
-- SHARE MODE still allows concurrent SELECTs, so read paths (feed,
-- admin dashboard, etc.) are unaffected.
CREATE OR REPLACE FUNCTION purge_orphan_stories_batch(
  p_limit INTEGER,
  p_dry_run BOOLEAN
)
RETURNS TABLE (deleted_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Block concurrent writes to articles for the duration of this
  -- function. Short hold: single delete statement on up to p_limit
  -- stories. Pipeline ingest will briefly queue; intentional.
  LOCK TABLE articles IN SHARE MODE;

  IF p_dry_run THEN
    RETURN QUERY
      SELECT s.id
      FROM stories s
      WHERE NOT EXISTS (
        SELECT 1 FROM articles a WHERE a.story_id = s.id
      )
      LIMIT p_limit;
  ELSE
    RETURN QUERY
      WITH candidates AS (
        SELECT id
        FROM stories s
        WHERE NOT EXISTS (
          SELECT 1 FROM articles a WHERE a.story_id = s.id
        )
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM stories s
      USING candidates c
      WHERE s.id = c.id
        AND NOT EXISTS (
          SELECT 1 FROM articles a WHERE a.story_id = s.id
        )
      RETURNING s.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION purge_unembedded_articles_batch(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_expired_articles_batch(INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_orphan_stories_batch(INTEGER, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION purge_unembedded_articles_batch(INTEGER, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION purge_expired_articles_batch(INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION purge_orphan_stories_batch(INTEGER, BOOLEAN) TO service_role;
