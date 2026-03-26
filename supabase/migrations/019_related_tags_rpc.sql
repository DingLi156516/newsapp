-- RPC function: related tags by co-occurrence
-- Replaces the in-memory co-occurrence counting with a single SQL query.

CREATE OR REPLACE FUNCTION related_tags_by_co_occurrence(
  p_tag_id uuid,
  p_limit integer DEFAULT 15
)
RETURNS TABLE(
  id uuid,
  slug text,
  label text,
  description text,
  tag_type text,
  story_count integer,
  created_at timestamptz
) AS $$
  SELECT t.id, t.slug, t.label, t.description, t.tag_type, t.story_count, t.created_at
  FROM story_tags st
  INNER JOIN tags t ON t.id = st.tag_id
  WHERE st.story_id IN (
    SELECT st2.story_id FROM story_tags st2 WHERE st2.tag_id = p_tag_id
  )
  AND st.tag_id != p_tag_id
  GROUP BY t.id
  ORDER BY COUNT(*) DESC
  LIMIT p_limit
$$ LANGUAGE sql STABLE;
