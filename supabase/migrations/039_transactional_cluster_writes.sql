-- 039_transactional_cluster_writes.sql
-- Transactional cluster writes: eliminate orphan stories on partial failure.
--
-- Problem 1: lib/ai/clustering.ts creates a new story row THEN assigns its
-- articles in separate UPDATE calls. If the assignment step fails mid-batch,
-- an empty story row remains in the database. The existing rollback path
-- deletes the orphan story, but only when the very first assignment
-- in the batch fails — partial-assignment failures leave orphans.
--
-- Problem 2: lib/ai/recluster.ts merges stories by reassigning articles,
-- recomputing centroid, updating the target, then deleting the source.
-- Only the target-update failure has a compensating rollback path.
--
-- This migration wraps each multi-row mutation in a SECURITY DEFINER RPC
-- that executes inside a single BEGIN/COMMIT transaction. If any step
-- raises, the entire transaction is rolled back atomically.

-- ---------------------------------------------------------------------------
-- create_story_with_articles — atomic story creation + article assignment
-- ---------------------------------------------------------------------------
-- Inserts a new story row and assigns the specified articles to it, all
-- inside a single transaction. Returns the new story id on success.
--
-- The caller passes the story payload as JSONB so we don't have to encode
-- every story column in the function signature. Only the fields we care
-- about at creation time are extracted; the rest rely on table defaults.

CREATE OR REPLACE FUNCTION create_story_with_articles(
  p_story JSONB,
  p_article_ids UUID[]
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
  WHERE id = ANY(p_article_ids);

  GET DIAGNOSTICS v_assigned = ROW_COUNT;

  IF v_assigned <> array_length(p_article_ids, 1) THEN
    -- Partial assignment: roll back the entire transaction so the story
    -- row is never observed by other readers.
    RAISE EXCEPTION
      'Expected to assign % articles, assigned %',
      array_length(p_article_ids, 1), v_assigned;
  END IF;

  RETURN v_story_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- merge_stories — atomic story merge
-- ---------------------------------------------------------------------------
-- Reassigns all articles from p_source to p_target, updates the target
-- centroid, then deletes the source. All in a single transaction: if any
-- step fails, the entire merge is rolled back.

CREATE OR REPLACE FUNCTION merge_stories(
  p_target UUID,
  p_source UUID,
  p_new_centroid JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_target_exists INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_target_exists FROM stories WHERE id = p_target;
  IF v_target_exists = 0 THEN
    RAISE EXCEPTION 'merge_stories: target story % not found', p_target;
  END IF;

  UPDATE articles
  SET story_id = p_target
  WHERE story_id = p_source;

  UPDATE stories
  SET cluster_centroid = (p_new_centroid::text)::vector
  WHERE id = p_target;

  DELETE FROM stories WHERE id = p_source;

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- delete_empty_story — compensating helper
-- ---------------------------------------------------------------------------
-- Convenience helper for any ad-hoc code path that needs to remove a story
-- that should have no articles attached. Uses a LEFT JOIN guard so we
-- never accidentally delete a story that still holds content.

CREATE OR REPLACE FUNCTION delete_empty_story(p_story_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM stories
  WHERE id = p_story_id
    AND NOT EXISTS (SELECT 1 FROM articles WHERE articles.story_id = p_story_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION create_story_with_articles(JSONB, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION merge_stories(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_empty_story(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_story_with_articles(JSONB, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION merge_stories(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION delete_empty_story(UUID) TO service_role;
