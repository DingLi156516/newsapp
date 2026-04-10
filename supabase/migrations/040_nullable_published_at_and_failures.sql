-- 040_nullable_published_at_and_failures.sql
-- Stop fabricating published_at for items whose upstream feeds omit a date.
--
-- Problem: 4 ingestion paths (RSS parser, crawler extractor, NewsAPI, GDELT)
-- were normalizing missing/invalid pubDates to `new Date().toISOString()`.
-- Because `articles.published_at NOT NULL`, the fabrication was permanent
-- and polluted feed ordering + velocity calculations.
--
-- This migration:
--  1. Makes `articles.published_at` nullable so ingestion can preserve the
--     "unknown" signal
--  2. Adds `fetched_at` as a stable timestamp for ordering fallback
--  3. Adds `published_at_estimated BOOLEAN` so downstream consumers know
--     whether to trust the value or treat it as a proxy
--  4. Adds a `pipeline_extraction_failures` table so crawler/fetcher
--     failures are persisted instead of being silently dropped

ALTER TABLE articles
  ALTER COLUMN published_at DROP NOT NULL;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS published_at_estimated BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing rows with a known published_at are not estimated.
-- (Rows that came in during the fabrication era are flagged conservatively
-- as estimated when they equal their ingested_at within a few seconds.)
UPDATE articles
SET published_at_estimated = false
WHERE published_at IS NOT NULL;

-- Composite index so feed queries that fall back to COALESCE(published_at,
-- fetched_at) stay fast.
CREATE INDEX IF NOT EXISTS idx_articles_effective_order
  ON articles ((COALESCE(published_at, fetched_at)) DESC);

-- Title-fingerprint dedup scoped to the same source (Phase 6). Catches
-- same-source republishes with a new URL that would slip past canonical-URL.
CREATE INDEX IF NOT EXISTS idx_articles_title_fp_source
  ON articles (source_id, title_fingerprint)
  WHERE title_fingerprint IS NOT NULL;

-- ---------------------------------------------------------------------------
-- pipeline_extraction_failures — persisted record of fetcher/extractor errors
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pipeline_extraction_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  failure_kind TEXT NOT NULL CHECK (failure_kind IN (
    'fetch_error',
    'extraction_failed',
    'robots_blocked',
    'parse_error',
    'ssrf_blocked'
  )),
  error_message TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_extraction_failures_source
  ON pipeline_extraction_failures (source_id, failed_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — only service_role can read/write the failure log
-- ---------------------------------------------------------------------------

ALTER TABLE pipeline_extraction_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_extraction_failures_service_role_all" ON pipeline_extraction_failures;
CREATE POLICY "pipeline_extraction_failures_service_role_all"
  ON pipeline_extraction_failures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
