BEGIN;

-- 1. Delete old unembedded articles (>7 days, never got embeddings)
DELETE FROM articles
WHERE is_embedded = false
  AND created_at < now() - interval '7 days';

-- 2. Delete expired articles (embedded but never clustered, already marked dead)
DELETE FROM articles
WHERE clustering_status = 'expired';

-- 3. Reset stale embedding claims (>30 min TTL)
UPDATE articles SET embedding_claimed_at = NULL
WHERE embedding_claimed_at IS NOT NULL
  AND is_embedded = false
  AND embedding_claimed_at < now() - interval '30 minutes';

-- 4. Reset stale clustering claims (>30 min TTL)
UPDATE articles SET clustering_claimed_at = NULL
WHERE clustering_claimed_at IS NOT NULL
  AND story_id IS NULL
  AND clustering_status = 'pending'
  AND clustering_claimed_at < now() - interval '30 minutes';

-- 5. Delete orphaned stories (no articles remaining)
DELETE FROM stories
WHERE id NOT IN (
  SELECT DISTINCT story_id FROM articles WHERE story_id IS NOT NULL
);

COMMIT;
