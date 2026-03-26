-- Migration 017: Fix source_count to reflect unique sources (was storing article count)

-- Recalculate source_count as count of distinct source_ids
UPDATE stories s
SET source_count = sub.unique_sources
FROM (
  SELECT story_id, COUNT(DISTINCT source_id) AS unique_sources
  FROM articles
  WHERE story_id IS NOT NULL
  GROUP BY story_id
) sub
WHERE s.id = sub.story_id
  AND s.source_count != sub.unique_sources;

-- Unpublish stories with fewer than 2 unique sources
UPDATE stories
SET publication_status = 'needs_review',
    review_status = 'pending',
    review_reasons = '["sparse_coverage"]'::jsonb
WHERE publication_status = 'published'
  AND source_count < 2;
