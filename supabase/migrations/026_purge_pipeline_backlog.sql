-- Purge stale pipeline backlog to start fresh.
-- After removing 7-day expiry filters, ~1184 unembedded and ~2068 unclustered
-- articles remain that will never produce useful stories.

-- 1. Delete unembedded articles (never got embeddings, not worth API cost)
DELETE FROM articles
WHERE is_embedded = false;

-- 2. Delete unclustered pending articles (embedded but never assigned to a story)
DELETE FROM articles
WHERE is_embedded = true
  AND story_id IS NULL
  AND clustering_status = 'pending';

-- 3. Clean up any orphaned stories left behind
DELETE FROM stories
WHERE id NOT IN (
  SELECT DISTINCT story_id FROM articles WHERE story_id IS NOT NULL
);
