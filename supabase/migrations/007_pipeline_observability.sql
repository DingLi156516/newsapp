-- Pipeline run history
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('ingest', 'process', 'full')),
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  steps JSONB NOT NULL DEFAULT '[]',
  summary JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pipeline_runs_type_started ON pipeline_runs(run_type, started_at DESC);

-- Source health tracking (add columns to existing sources table)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetch_at TIMESTAMPTZ;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetch_status TEXT DEFAULT 'unknown'
  CHECK (last_fetch_status IN ('success', 'timeout', 'http_error', 'parse_error', 'dns_error', 'unknown'));
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetch_error TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS consecutive_failures INT DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS total_articles_ingested INT DEFAULT 0;
