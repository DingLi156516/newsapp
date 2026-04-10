-- 044_pipeline_stage_events.sql
-- Structured stage events for pipeline observability.
-- Closes Codex review finding #9 (MEDIUM).
--
-- Purpose: give operators a correlated drill-down of warn/error events
-- during a pipeline run, keyed by the existing pipeline_runs.id as run_id
-- and the per-run claim_owner UUID. Phases 1-8 landed structured run-level
-- telemetry (pipeline_runs.steps); this phase closes the last observability
-- gap — the per-stage warn/error sites that previously logged only to
-- Vercel stdout via console.warn/error and could not be correlated to a
-- specific run.
--
-- Related docs: docs/architecture.md (Observability), docs/operations.md
-- (Investigating a degraded run runbook).

CREATE TABLE IF NOT EXISTS pipeline_stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  claim_owner UUID,
  stage TEXT NOT NULL CHECK (stage IN (
    'ingest', 'embed', 'cluster', 'assemble', 'recluster'
  )),
  source_id UUID,
  provider TEXT,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  event_type TEXT NOT NULL,
  item_id UUID,
  duration_ms INTEGER,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_events_run
  ON pipeline_stage_events (run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_stage_events_level
  ON pipeline_stage_events (level, created_at DESC)
  WHERE level IN ('warn', 'error');

CREATE INDEX IF NOT EXISTS idx_stage_events_stage
  ON pipeline_stage_events (stage, created_at DESC);

-- Default admin drill-down (no filter) orders by created_at DESC. Without
-- this index the panel would degrade to a full scan + sort as the table
-- grows, which would make observability unavailable during incidents.
CREATE INDEX IF NOT EXISTS idx_stage_events_created_at_desc
  ON pipeline_stage_events (created_at DESC);

ALTER TABLE pipeline_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_stage_events_service_role_all"
  ON pipeline_stage_events;

CREATE POLICY "pipeline_stage_events_service_role_all"
  ON pipeline_stage_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
