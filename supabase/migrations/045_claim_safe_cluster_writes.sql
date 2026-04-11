-- 045_claim_safe_cluster_writes.sql
-- Phase 10 claim-safety audit: add an owner predicate to the
-- create_story_with_articles RPC so a stale clustering worker past
-- its claim TTL cannot promote a singleton / create a duplicate-story
-- wrapper against articles whose claim now belongs to a newer worker.
--
-- This is an additive change: the function now requires a p_owner
-- parameter. Callers are updated in lib/pipeline/cluster-writes.ts and
-- lib/ai/clustering.ts in the same phase. No data changes.
--
-- Relation to migration 039: 039 introduced the transactional cluster
-- write. 045 adds the owner predicate that Phase 7b/9 reviews flagged
-- as missing. The old 2-arg signature is explicitly dropped so any
-- stale deployed binary still calling the 2-arg version fails loud at
-- deploy time rather than bypassing the new owner predicate.

CREATE OR REPLACE FUNCTION create_story_with_articles(
  p_story JSONB,
  p_article_ids UUID[],
  p_owner UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story_id UUID;
  v_assigned INTEGER;
BEGIN
  IF p_article_ids IS NULL OR array_length(p_article_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'create_story_with_articles requires at least one article id';
  END IF;

  IF p_owner IS NULL THEN
    RAISE EXCEPTION 'create_story_with_articles requires p_owner (Phase 10 claim-safety)';
  END IF;

  INSERT INTO stories (
    headline,
    story_kind,
    topic,
    source_count,
    image_url,
    cluster_centroid,
    assembly_status,
    publication_status,
    review_status,
    review_reasons,
    first_published
  )
  VALUES (
    COALESCE(p_story->>'headline', 'Pending headline generation'),
    COALESCE(p_story->>'story_kind', 'standard'),
    COALESCE(p_story->>'topic', 'politics'),
    COALESCE((p_story->>'source_count')::int, 0),
    NULLIF(p_story->>'image_url', ''),
    (p_story->'cluster_centroid')::text::vector,
    COALESCE(p_story->>'assembly_status', 'pending'),
    COALESCE(p_story->>'publication_status', 'draft'),
    COALESCE(p_story->>'review_status', 'pending'),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_story->'review_reasons')),
      '{}'::text[]
    ),
    COALESCE((p_story->>'first_published')::timestamptz, now())
  )
  RETURNING id INTO v_story_id;

  UPDATE articles
  SET
    story_id = v_story_id,
    clustering_claimed_at = NULL,
    clustering_claim_owner = NULL,
    clustering_status = 'clustered'
  WHERE id = ANY(p_article_ids)
    AND clustering_claim_owner = p_owner;

  GET DIAGNOSTICS v_assigned = ROW_COUNT;

  IF v_assigned <> array_length(p_article_ids, 1) THEN
    -- Either ownership moved on one or more articles, or the row set
    -- is incomplete. Roll back the story insert so no orphan story is
    -- observable. Callers receive this as an error and treat it as
    -- "ownership moved" — they do NOT retry as a fresh failure.
    RAISE EXCEPTION
      'create_story_with_articles: owner-scoped assignment matched % of % articles (ownership moved or row missing)',
      v_assigned, array_length(p_article_ids, 1)
      USING ERRCODE = 'P0010';
  END IF;

  RETURN v_story_id;
END;
$$;

-- Drop the old 2-arg signature explicitly so any call site still using
-- the old shape fails loud at deploy time instead of silently matching
-- a different overload.
-- Note: at deploy time, warm PgBouncer/Supavisor connections may
-- briefly hit `function does not exist` until they reconnect. The
-- cron retry cadence covers this — it's one transient error per
-- pool connection, not a rollback trigger.
DROP FUNCTION IF EXISTS create_story_with_articles(JSONB, UUID[]);

REVOKE ALL ON FUNCTION create_story_with_articles(JSONB, UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_story_with_articles(JSONB, UUID[], UUID) TO service_role;
