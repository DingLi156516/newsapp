-- 049_fix_review_reasons_jsonb_cast.sql
-- Fix: create_story_with_articles RPC produces text[] for review_reasons
-- but the column is jsonb. Cast via to_jsonb() so the INSERT succeeds.

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
      p_story->'review_reasons',
      '[]'::jsonb
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
    RAISE EXCEPTION
      'create_story_with_articles: owner-scoped assignment matched % of % articles (ownership moved or row missing)',
      v_assigned, array_length(p_article_ids, 1)
      USING ERRCODE = 'P0010';
  END IF;

  RETURN v_story_id;
END;
$$;

REVOKE ALL ON FUNCTION create_story_with_articles(JSONB, UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_story_with_articles(JSONB, UUID[], UUID) TO service_role;
