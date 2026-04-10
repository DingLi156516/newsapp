-- 041_retry_metadata_and_dlq.sql
-- Unified retry semantics + dead-letter queue for pipeline stages.
--
-- Problem: three stages had three different failure behaviors:
--   1. Crawler silently dropped failed extractions (fixed in 040)
--   2. Embedding failures cleared the claim with no backoff, causing hot
--      retry loops on poison pills
--   3. Assembly failures became terminal ('failed' status) until a manual
--      admin reprocess — no automatic retry, no DLQ for investigation
--
-- This migration adds:
--   - Per-stage retry metadata on articles + stories
--   - A pipeline_dead_letter table for items that exceeded the retry budget
--   - An extension to the Phase 1 claim RPCs so claims never return rows
--     that are inside their backoff window

-- ---------------------------------------------------------------------------
-- Per-stage retry metadata
-- ---------------------------------------------------------------------------

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS embedding_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding_last_error TEXT,
  ADD COLUMN IF NOT EXISTS clustering_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clustering_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clustering_last_error TEXT;

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS assembly_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assembly_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assembly_last_error TEXT;

-- ---------------------------------------------------------------------------
-- pipeline_dead_letter — exhausted retry items for investigation/replay
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pipeline_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_kind TEXT NOT NULL CHECK (item_kind IN (
    'article_embed',
    'article_cluster',
    'story_assemble'
  )),
  item_id UUID NOT NULL,
  retry_count INTEGER NOT NULL,
  last_error TEXT NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dlq_unreplayed
  ON pipeline_dead_letter (item_kind, failed_at DESC)
  WHERE replayed_at IS NULL;

ALTER TABLE pipeline_dead_letter ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_dead_letter_service_role_all" ON pipeline_dead_letter;
CREATE POLICY "pipeline_dead_letter_service_role_all"
  ON pipeline_dead_letter
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Replace claim RPCs from migration 037 to honor the next_attempt_at gate
-- ---------------------------------------------------------------------------
-- Migrations 037's claim functions only checked is_embedded / story_id /
-- claim expiry. We extend them here so rows inside their exponential-backoff
-- window (embedding_next_attempt_at > now()) are never returned. The
-- function bodies replace the old versions via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION claim_articles_for_embedding(
  p_owner UUID,
  p_limit INTEGER,
  p_ttl_seconds INTEGER
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE articles
  SET
    embedding_claimed_at = now(),
    embedding_claim_owner = p_owner
  WHERE id IN (
    SELECT id FROM articles
    WHERE is_embedded = false
      AND (
        embedding_claimed_at IS NULL
        OR embedding_claimed_at < now() - make_interval(secs => p_ttl_seconds)
      )
      AND (
        embedding_next_attempt_at IS NULL
        OR embedding_next_attempt_at <= now()
      )
    ORDER BY created_at ASC, id ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
END;
$$;

CREATE OR REPLACE FUNCTION claim_articles_for_clustering(
  p_owner UUID,
  p_limit INTEGER,
  p_ttl_seconds INTEGER
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE articles
  SET
    clustering_claimed_at = now(),
    clustering_claim_owner = p_owner
  WHERE id IN (
    SELECT id FROM articles
    WHERE is_embedded = true
      AND story_id IS NULL
      AND clustering_status = 'pending'
      AND (
        clustering_claimed_at IS NULL
        OR clustering_claimed_at < now() - make_interval(secs => p_ttl_seconds)
      )
      AND (
        clustering_next_attempt_at IS NULL
        OR clustering_next_attempt_at <= now()
      )
    ORDER BY published_at ASC, id ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
END;
$$;

CREATE OR REPLACE FUNCTION claim_stories_for_assembly(
  p_owner UUID,
  p_limit INTEGER,
  p_ttl_seconds INTEGER
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE stories
  SET
    assembly_status = 'processing',
    assembly_claimed_at = now(),
    assembly_claim_owner = p_owner
  WHERE id IN (
    SELECT id FROM stories
    WHERE assembly_status = 'pending'
      AND (
        assembly_claimed_at IS NULL
        OR assembly_claimed_at < now() - make_interval(secs => p_ttl_seconds)
      )
      AND (
        assembly_next_attempt_at IS NULL
        OR assembly_next_attempt_at <= now()
      )
    ORDER BY first_published ASC, id ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
END;
$$;
