-- 020_tag_publication_scoping.sql — Scope tags to published stories.
--
-- Fixes five issues found in code review:
-- (a) story_tags RLS leaks unpublished story associations to public readers
-- (b) story_count trigger counts unpublished stories
-- (c) related_tags_by_co_occurrence RPC returns tags from unpublished stories
-- (d) tags RLS USING(true) leaks unpublished entity names
-- (e) CASCADE delete of stories skips story_count decrement

-- ---------------------------------------------------------------------------
-- (a) Restrict story_tags public read to published stories
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "story_tags_public_read" ON story_tags;
CREATE POLICY "story_tags_public_read" ON story_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = story_tags.story_id
      AND (stories.publication_status = 'published' OR is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- (b) Make story_count trigger publication-aware
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_tag_story_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM stories WHERE id = NEW.story_id AND publication_status = 'published') THEN
      UPDATE tags SET story_count = story_count + 1 WHERE id = NEW.tag_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM stories WHERE id = OLD.story_id AND publication_status = 'published') THEN
      UPDATE tags SET story_count = story_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Keep counts accurate when publication_status changes (e.g. admin review)
CREATE OR REPLACE FUNCTION update_tag_counts_on_publication_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.publication_status != 'published' AND NEW.publication_status = 'published' THEN
    UPDATE tags SET story_count = story_count + 1
    WHERE id IN (SELECT tag_id FROM story_tags WHERE story_id = NEW.id);
  ELSIF OLD.publication_status = 'published' AND NEW.publication_status != 'published' THEN
    UPDATE tags SET story_count = story_count - 1
    WHERE id IN (SELECT tag_id FROM story_tags WHERE story_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tag_counts_on_publication_change
AFTER UPDATE OF publication_status ON stories
FOR EACH ROW
EXECUTE FUNCTION update_tag_counts_on_publication_change();

-- Backfill existing counts to correct state
UPDATE tags t
SET story_count = (
  SELECT COUNT(*)
  FROM story_tags st
  INNER JOIN stories s ON s.id = st.story_id
  WHERE st.tag_id = t.id
  AND s.publication_status = 'published'
);

-- ---------------------------------------------------------------------------
-- (c) Filter related-tags RPC by publication status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION related_tags_by_co_occurrence(
  p_tag_id uuid,
  p_limit integer DEFAULT 15
)
RETURNS TABLE(
  id uuid, slug text, label text, description text,
  tag_type text, story_count integer, created_at timestamptz
) AS $$
  SELECT t.id, t.slug, t.label, t.description, t.tag_type, t.story_count, t.created_at
  FROM story_tags st
  INNER JOIN tags t ON t.id = st.tag_id
  INNER JOIN stories s ON s.id = st.story_id
  WHERE st.story_id IN (
    SELECT st2.story_id
    FROM story_tags st2
    INNER JOIN stories s2 ON s2.id = st2.story_id
    WHERE st2.tag_id = p_tag_id
    AND s2.publication_status = 'published'
  )
  AND st.tag_id != p_tag_id
  AND s.publication_status = 'published'
  GROUP BY t.id
  ORDER BY COUNT(*) DESC
  LIMIT p_limit
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- (d) Restrict tags public read to tags with published stories
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "tags_public_read" ON tags;
CREATE POLICY "tags_public_read" ON tags
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM story_tags st
      INNER JOIN stories s ON s.id = st.story_id
      WHERE st.tag_id = tags.id
      AND s.publication_status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- (e) Cascade-safe count decrement on story delete
-- ---------------------------------------------------------------------------
-- When a published story is deleted, ON DELETE CASCADE removes story_tags rows.
-- The existing AFTER DELETE trigger on story_tags checks EXISTS(stories), but
-- the parent row is already gone → no decrement → counts drift upward.
-- Fix: BEFORE DELETE on stories decrements while the row still exists.
-- The story_tags AFTER DELETE trigger harmlessly no-ops on cascade
-- (stories row gone → EXISTS false → no decrement → no double-count).

CREATE OR REPLACE FUNCTION update_tag_counts_on_story_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.publication_status = 'published' THEN
    UPDATE tags SET story_count = story_count - 1
    WHERE id IN (SELECT tag_id FROM story_tags WHERE story_id = OLD.id);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tag_counts_on_story_delete
BEFORE DELETE ON stories
FOR EACH ROW
EXECUTE FUNCTION update_tag_counts_on_story_delete();
