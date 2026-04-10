-- 036_atomic_ingestion_helpers.sql
-- Atomic pipeline helpers for concurrent ingestion runs.
--
-- Phase 11A+11B introduces three new concurrency hazards:
--  1. News API rate limiter state was in-process only
--  2. Source health counters were read-modify-write races
--  3. NewsAPI/GDELT quota needed shared storage
--
-- This migration adds shared-state quotas and atomic RPC helpers that replace
-- the racy read-modify-write pattern in lib/ingestion/pipeline-helpers.ts
-- and lib/news-api/rate-limiter.ts.

-- ---------------------------------------------------------------------------
-- news_api_quota table — shared quota state across all Node processes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS news_api_quota (
  provider TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  reset_date DATE NOT NULL DEFAULT (timezone('utc', now())::date),
  last_request_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE news_api_quota ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write quota state
DROP POLICY IF EXISTS "news_api_quota_service_role_all" ON news_api_quota;
CREATE POLICY "news_api_quota_service_role_all"
  ON news_api_quota
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- acquire_news_api_quota — atomic check + increment for daily quotas
-- ---------------------------------------------------------------------------
-- Returns true if the caller got a quota slot, false if exhausted.
-- Uses INSERT ... ON CONFLICT + row locking to serialize check+increment.

CREATE OR REPLACE FUNCTION acquire_news_api_quota(
  p_provider TEXT,
  p_max_per_day INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE := timezone('utc', now())::date;
  v_count INTEGER;
BEGIN
  -- Upsert the row, resetting count if the day rolled over
  INSERT INTO news_api_quota (provider, request_count, reset_date, last_request_at, updated_at)
  VALUES (p_provider, 1, v_today, now(), now())
  ON CONFLICT (provider) DO UPDATE
    SET request_count = CASE
          WHEN news_api_quota.reset_date = v_today
            THEN news_api_quota.request_count + 1
          ELSE 1
        END,
        reset_date = v_today,
        last_request_at = now(),
        updated_at = now()
    WHERE news_api_quota.reset_date < v_today
       OR news_api_quota.request_count < p_max_per_day
  RETURNING request_count INTO v_count;

  -- If the UPDATE was blocked by the WHERE clause (quota full for today),
  -- no row is returned and v_count is NULL.
  RETURN v_count IS NOT NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_news_api_quota — read-only quota status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_news_api_quota(p_provider TEXT)
RETURNS TABLE (
  used INTEGER,
  reset_date DATE,
  last_request_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE := timezone('utc', now())::date;
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN q.reset_date = v_today THEN q.request_count ELSE 0 END,
    q.reset_date,
    q.last_request_at
  FROM news_api_quota q
  WHERE q.provider = p_provider;
END;
$$;

-- ---------------------------------------------------------------------------
-- increment_source_success — atomic source health update on success
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_source_success(
  p_source_id UUID,
  p_articles_added INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE sources
  SET
    last_fetch_at = now(),
    last_fetch_status = 'success',
    last_fetch_error = NULL,
    consecutive_failures = 0,
    total_articles_ingested = total_articles_ingested + GREATEST(p_articles_added, 0),
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- increment_source_failure — atomic source health update on failure
-- ---------------------------------------------------------------------------

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
BEGIN
  UPDATE sources
  SET
    last_fetch_at = now(),
    last_fetch_status = p_status,
    last_fetch_error = p_error,
    consecutive_failures = consecutive_failures + 1,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lock down execute privileges
-- ---------------------------------------------------------------------------
-- These functions are SECURITY DEFINER and bypass RLS. Revoke the default
-- PUBLIC execute privilege first, then grant only to service_role. Without
-- the REVOKE, anon and authenticated roles could call RLS-bypassing helpers.

REVOKE ALL ON FUNCTION acquire_news_api_quota(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_news_api_quota(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_source_success(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_source_failure(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION acquire_news_api_quota(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_news_api_quota(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_source_success(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_source_failure(UUID, TEXT, TEXT) TO service_role;
