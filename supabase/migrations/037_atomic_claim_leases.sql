-- 037_atomic_claim_leases.sql
-- Atomic claim leases for the processing pipeline.
--
-- Problem: All three processing stages (embed, cluster, assemble) used a
-- read-filter-update pattern for claiming work:
--   SELECT N rows → filter in app via isClaimAvailable() → UPDATE by id.
-- This has no DB-side compare-and-set and no owner token, so two overlapping
-- runners could claim identical rows. A stale worker could also release a
-- newer worker's claim because releases were keyed by row id only.
--
-- This migration mirrors the SECURITY DEFINER + REVOKE PUBLIC pattern from
-- migration 036. It adds:
--   - claim_owner UUID columns on articles and stories
--   - composite indexes that keep claim acquisition cheap under load
--   - six SECURITY DEFINER RPCs that perform atomic UPDATE ... WHERE (owner
--     is null OR claim is expired) RETURNING id, using FOR UPDATE SKIP LOCKED
--   - symmetric owner-scoped release RPCs
-- All callable by service_role only.

-- ---------------------------------------------------------------------------
-- Claim owner columns
-- ---------------------------------------------------------------------------

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS embedding_claim_owner UUID,
  ADD COLUMN IF NOT EXISTS clustering_claim_owner UUID;

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS assembly_claim_owner UUID;

-- ---------------------------------------------------------------------------
-- Indexes to keep claim acquisition cheap
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_articles_embed_claim
  ON articles (is_embedded, embedding_claimed_at)
  WHERE is_embedded = false;

CREATE INDEX IF NOT EXISTS idx_articles_cluster_claim
  ON articles (clustering_status, clustering_claimed_at)
  WHERE clustering_status = 'pending' AND story_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_stories_assembly_claim
  ON stories (assembly_status, assembly_claimed_at)
  WHERE assembly_status = 'pending';

-- ---------------------------------------------------------------------------
-- claim_articles_for_embedding — atomic batch claim for embedding stage
-- ---------------------------------------------------------------------------
-- Returns the UUIDs that this owner successfully claimed. Any row already
-- held by a non-expired claim is skipped via FOR UPDATE SKIP LOCKED and the
-- expiry predicate.

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
    ORDER BY created_at ASC, id ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
END;
$$;

-- ---------------------------------------------------------------------------
-- claim_articles_for_clustering — atomic batch claim for clustering stage
-- ---------------------------------------------------------------------------

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
    ORDER BY published_at ASC, id ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
END;
$$;

-- ---------------------------------------------------------------------------
-- claim_stories_for_assembly — atomic batch claim for assembly stage
-- ---------------------------------------------------------------------------

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
    ORDER BY first_published ASC, id ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
END;
$$;

-- ---------------------------------------------------------------------------
-- release_embedding_claim — owner-scoped release
-- ---------------------------------------------------------------------------
-- Clears the claim only when the current owner matches. A stale worker
-- cannot release a newer worker's claim.

CREATE OR REPLACE FUNCTION release_embedding_claim(
  p_article_id UUID,
  p_owner UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE articles
  SET
    embedding_claimed_at = NULL,
    embedding_claim_owner = NULL
  WHERE id = p_article_id
    AND embedding_claim_owner = p_owner;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- release_clustering_claim — owner-scoped release
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION release_clustering_claim(
  p_article_id UUID,
  p_owner UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE articles
  SET
    clustering_claimed_at = NULL,
    clustering_claim_owner = NULL
  WHERE id = p_article_id
    AND clustering_claim_owner = p_owner;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- release_assembly_claim — owner-scoped release
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION release_assembly_claim(
  p_story_id UUID,
  p_owner UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE stories
  SET
    assembly_claimed_at = NULL,
    assembly_claim_owner = NULL
  WHERE id = p_story_id
    AND assembly_claim_owner = p_owner;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lock down execute privileges
-- ---------------------------------------------------------------------------
-- These functions are SECURITY DEFINER and bypass RLS. Revoke the default
-- PUBLIC execute privilege first, then grant only to service_role.

REVOKE ALL ON FUNCTION claim_articles_for_embedding(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_articles_for_clustering(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_stories_for_assembly(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_embedding_claim(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_clustering_claim(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_assembly_claim(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION claim_articles_for_embedding(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION claim_articles_for_clustering(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION claim_stories_for_assembly(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION release_embedding_claim(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION release_clustering_claim(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION release_assembly_claim(UUID, UUID) TO service_role;
