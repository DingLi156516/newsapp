-- 059_pipeline_backlog_snapshots.sql
-- Hourly (15-min cadence) backlog snapshots for sparkline trends.
--
-- Purpose: lets operators see whether a backlog tile is trending up,
-- flat, or just spiked — without leaving /admin/pipeline. Without this
-- table, the dashboard only shows the current count and operators must
-- query the DB by hand to see "did this number just change?".
--
-- Capture site: app/api/cron/process/route.ts (every 15 min). The write
-- is best-effort — if it fails, the pipeline run still succeeds. See
-- docs/operations.md → "Backlog snapshots" for the runbook.

CREATE TABLE IF NOT EXISTS pipeline_backlog_snapshots (
  captured_at TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
  unembedded_count INTEGER NOT NULL,
  unclustered_count INTEGER NOT NULL,
  pending_assembly_count INTEGER NOT NULL,
  review_queue_count INTEGER NOT NULL,
  stale_claim_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_backlog_snapshots_captured_at
  ON pipeline_backlog_snapshots (captured_at DESC);

ALTER TABLE pipeline_backlog_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_backlog_snapshots_service_role_all"
  ON pipeline_backlog_snapshots;

CREATE POLICY "pipeline_backlog_snapshots_service_role_all"
  ON pipeline_backlog_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-purge older than 14 days. Run-time deletion happens lazily via the
-- maintenance cron; this is just the marker query for that job to use.
COMMENT ON TABLE pipeline_backlog_snapshots IS
  'Backlog snapshots captured every 15 min. Retain 14 days; older rows '
  'should be deleted by the maintenance cron.';
