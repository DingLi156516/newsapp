-- Migration 054: Multiply trending_score by engagement_factor.
--
-- Phase 3 ranking integration. The Phase 1 trending formula was
--   trending = impact × (1 + log10(articles_24h)) × diversity × time_decay
-- This migration extends it with a fifth factor sourced from migration 053's
-- story_views table:
--   engagement_factor = 1 + log10(1 + unique_viewers_6h)
-- where unique_viewers_6h counts distinct session_ids that posted a `view`
-- event for the story in the last 6 hours. log10(1 + N) keeps the
-- multiplier at exactly 1 when no engagement has been recorded, so newly
-- published / unmeasured stories keep their editorial score intact.
--
-- This rewrites refresh_trending_scores() in place. The TS port at
-- lib/api/trending-score.ts is updated to match (engagementFactor helper
-- + uniqueViewersRecent input on TrendingInputs). Refresh continues to
-- be invoked by the existing process / refresh-trending crons — no new
-- scheduling is introduced.

CREATE OR REPLACE FUNCTION refresh_trending_scores()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  refreshed_count INTEGER;
  lock_key CONSTANT BIGINT := 50010000050;
BEGIN
  IF NOT pg_try_advisory_xact_lock(lock_key) THEN
    RETURN -1;
  END IF;

  SET LOCAL statement_timeout = '30s';

  -- Engagement factor is computed via a correlated subquery on
  -- story_views per row. Postgres UPDATE...FROM does not put the target
  -- alias `s` in scope inside FROM-clause JOINs, so a CTE+LEFT JOIN
  -- approach (the obvious shape) actually fails to parse. The
  -- correlated subquery hits the (story_id, action, created_at DESC)
  -- index added in migration 053 and stays a single index range scan
  -- per story — fast at our row counts and avoids a self-join on
  -- the (potentially large) stories table.
  WITH updated AS (
    UPDATE stories s
    SET trending_score = (
      COALESCE(s.impact_score, 0)::numeric
      * (1 + LOG(GREATEST(
          CASE
            WHEN jsonb_typeof(s.story_velocity->'articles_24h') = 'number'
              THEN (s.story_velocity->>'articles_24h')::numeric
            ELSE 0
          END, 1
        )))
      * compute_diversity_factor(s.spectrum_segments)::numeric
      * (1.0 / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - s.published_at)) / 3600.0, 0) + 2, 1.5))
      * (1 + LOG(1 + COALESCE(
          (
            SELECT COUNT(DISTINCT sv.session_id)::numeric
            FROM story_views sv
            WHERE sv.story_id = s.id
              AND sv.action = 'view'
              AND sv.created_at >= NOW() - INTERVAL '6 hours'
          ),
          0
        )))
    )::real
    WHERE s.publication_status = 'published'
      AND s.published_at IS NOT NULL
      AND s.published_at >= NOW() - INTERVAL '7 days'
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO refreshed_count FROM updated;

  -- Same eviction logic as before — keep the partial index lean.
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

REVOKE ALL ON FUNCTION refresh_trending_scores() FROM PUBLIC;
REVOKE ALL ON FUNCTION refresh_trending_scores() FROM anon;
REVOKE ALL ON FUNCTION refresh_trending_scores() FROM authenticated;
GRANT EXECUTE ON FUNCTION refresh_trending_scores() TO service_role;
