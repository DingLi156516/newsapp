-- Migration 050: Materialize trending_score on stories
--
-- Phase 1.5 follow-up to the Ground-News parity Phase 1 Trending feed.
-- The previous read-path implementation fetched the full 7-day candidate
-- window and ranked in memory, which made `/api/stories?sort=trending` a
-- high-amplification endpoint under real traffic (large DB reads + in-memory
-- sort per request). This migration moves ranking into SQL: every story
-- stores the time-decayed trending score computed at assembly time, and the
-- API simply orders by that column with normal pagination.
--
-- Staleness contract: trending_score is recomputed whenever a story is
-- re-assembled (new articles join the cluster). Between re-assemblies, the
-- time-decay component drifts — but the 7-day publication-window filter
-- bounds the drift, and the relative ordering stays approximately correct
-- for active stories. A later migration can add a refresh cron if needed.

ALTER TABLE stories ADD COLUMN trending_score REAL DEFAULT NULL;

-- Partial index scoped to published stories. Deliberately NOT further
-- constrained to `trending_score IS NOT NULL` so newly-assembled stories
-- (score = NULL until the next refresh tick) remain eligible for the feed
-- via `NULLS LAST` ordering with published_at as the tie-breaker — a ≤15-min
-- freshness gap would otherwise hide breaking news from the Trending tab.
-- The read path's `publication_status = 'published'` filter (implicit via
-- the story select) matches this predicate so the planner uses the index.
CREATE INDEX IF NOT EXISTS idx_stories_trending_score
  ON stories (trending_score DESC NULLS LAST, published_at DESC, id DESC)
  WHERE publication_status = 'published';

-- Port of `shannonDiversityFactor` from lib/api/trending-score.ts so the SQL
-- refresh path computes the same diversity signal the TS scorer uses.
--   factor = 0.5 + 0.5 × (normalized Shannon entropy over non-zero buckets)
-- Returns 0.5 (neutral) for empty/single-bucket spectra, matching TS.
--
-- Tolerant of malformed `spectrum_segments` rows: only JSON numbers are
-- counted; any element whose `percentage` is missing, null, or not a number
-- is treated as zero. One bad row must not abort the database-wide refresh.
CREATE OR REPLACE FUNCTION compute_diversity_factor(spectrum JSONB)
RETURNS REAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  nonzero_count INTEGER;
  total_pct NUMERIC;
  entropy NUMERIC;
  max_entropy NUMERIC;
  normalized NUMERIC;
BEGIN
  IF spectrum IS NULL OR jsonb_typeof(spectrum) <> 'array' OR jsonb_array_length(spectrum) = 0 THEN
    RETURN 0.5::real;
  END IF;

  -- Safe cast: only elements whose `percentage` is a JSON number contribute.
  WITH pcts AS (
    SELECT (s->>'percentage')::numeric AS pct
    FROM jsonb_array_elements(spectrum) AS s
    WHERE jsonb_typeof(s->'percentage') = 'number'
      AND (s->>'percentage')::numeric > 0
  )
  SELECT COUNT(*), SUM(pct)
  INTO nonzero_count, total_pct
  FROM pcts;

  IF nonzero_count IS NULL OR nonzero_count <= 1 OR total_pct IS NULL OR total_pct <= 0 THEN
    RETURN 0.5::real;
  END IF;

  SELECT -SUM(p * LN(p))
  INTO entropy
  FROM (
    SELECT (s->>'percentage')::numeric / total_pct AS p
    FROM jsonb_array_elements(spectrum) AS s
    WHERE jsonb_typeof(s->'percentage') = 'number'
      AND (s->>'percentage')::numeric > 0
  ) AS fractions;

  max_entropy := LN(nonzero_count);
  IF max_entropy = 0 THEN
    RETURN 0.5::real;
  END IF;

  normalized := entropy / max_entropy;
  RETURN (0.5 + 0.5 * normalized)::real;
EXCEPTION
  WHEN OTHERS THEN
    -- Defensive: any unforeseen malformation falls back to neutral.
    RETURN 0.5::real;
END;
$$;

-- Refresh function — recomputes `trending_score` for every published story in
-- the trending window using an SQL port of the TS `computeTrendingScore`:
--   trending = impact × (1 + log10(max(articles_24h, 1))) × diversity × time_decay
--   time_decay = 1 / (hours_since_published + 2) ^ 1.5
-- Diversity is the full Shannon factor via compute_diversity_factor() so an
-- echo-chamber story and a balanced story with identical other signals get
-- different scores — matching the TS algorithm's ranking behavior.
-- The process cron (app/api/cron/process/route.ts) calls this after each
-- assembly run so stored scores track wall-clock time — without the refresh
-- the time-decay term would freeze at assembly and older stories would keep
-- their initial rank indefinitely.
--
-- Also nulls out scores for stories that have aged out of the 7-day window
-- or lost `published` status. Without this cleanup the partial index
-- `idx_stories_trending_score` would grow unbounded because its predicate
-- is only `trending_score IS NOT NULL` — aged-out rows would accumulate and
-- the API `published_at >= now() - 7d` filter would have to scan them.
--
-- Returns the number of rows refreshed (nulled rows are not counted).
CREATE OR REPLACE FUNCTION refresh_trending_scores()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  refreshed_count INTEGER;
  -- Deterministic lock key; auto-released at end of enclosing xact.
  lock_key CONSTANT BIGINT := 50010000050;
BEGIN
  -- Single-flight guard: if a prior invocation is still running (manual
  -- trigger, overlapping cron tick, retry), return -1 without redoing
  -- work or contending on the same rows.
  IF NOT pg_try_advisory_xact_lock(lock_key) THEN
    RETURN -1;
  END IF;

  -- Bound execution so a misbehaving run cannot consume the serverless
  -- cron's time budget or hold locks indefinitely.
  SET LOCAL statement_timeout = '30s';

  WITH updated AS (
    UPDATE stories
    SET trending_score = (
      COALESCE(impact_score, 0)::numeric
      * (1 + LOG(GREATEST(
          CASE
            WHEN jsonb_typeof(story_velocity->'articles_24h') = 'number'
              THEN (story_velocity->>'articles_24h')::numeric
            ELSE 0
          END, 1
        )))
      * compute_diversity_factor(spectrum_segments)::numeric
      * (1.0 / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600.0, 0) + 2, 1.5))
    )::real
    WHERE publication_status = 'published'
      AND published_at IS NOT NULL
      AND published_at >= NOW() - INTERVAL '7 days'
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO refreshed_count FROM updated;

  -- Evict aged-out / unpublished rows from the partial index.
  UPDATE stories
  SET trending_score = NULL
  WHERE trending_score IS NOT NULL
    AND (
      publication_status <> 'published'
      OR published_at IS NULL
      OR published_at < NOW() - INTERVAL '7 days'
    );

  RETURN refreshed_count;
END;
$$;

-- Inline backfill, intentionally bounded. `refresh_trending_scores()` already
-- restricts its UPDATE to `publication_status = 'published' AND published_at
-- >= NOW() - INTERVAL '7 days'` — a few hundred rows at Axiom's current
-- volume (~55 sources × daily cadence). This is a single fast transaction,
-- not a full-table scan, and it guarantees the Trending tab works from
-- deploy minute 1 without relying on an external scheduler having been
-- configured. Ongoing freshness is the `/api/cron/refresh-trending` cron's
-- responsibility.
SELECT refresh_trending_scores();

-- Lock down RPC execution. Without this, PostgREST exposes these functions to
-- anon/authenticated clients, giving unauthenticated users a way to trigger
-- a database-wide UPDATE (write amplification / DoS path). The refresh is an
-- operational job; only the service role (used by the cron) should invoke it.
REVOKE ALL ON FUNCTION refresh_trending_scores() FROM PUBLIC;
REVOKE ALL ON FUNCTION refresh_trending_scores() FROM anon;
REVOKE ALL ON FUNCTION refresh_trending_scores() FROM authenticated;
GRANT EXECUTE ON FUNCTION refresh_trending_scores() TO service_role;

REVOKE ALL ON FUNCTION compute_diversity_factor(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION compute_diversity_factor(JSONB) FROM anon;
REVOKE ALL ON FUNCTION compute_diversity_factor(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION compute_diversity_factor(JSONB) TO service_role;
