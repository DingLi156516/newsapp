-- Migration 012: Backfill remaining helper fields and clear stale/non-terminal pipeline claims.

UPDATE articles
SET canonical_url = COALESCE(canonical_url, url)
WHERE canonical_url IS NULL;

UPDATE articles
SET title_fingerprint = BTRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(LOWER(COALESCE(title, '')), '[^a-z0-9\s]', ' ', 'g'),
    '\s+',
    ' ',
    'g'
  )
)
WHERE title_fingerprint IS NULL;

UPDATE articles
SET embedding_claimed_at = NULL
WHERE embedding_claimed_at IS NOT NULL
  AND (
    is_embedded = true
    OR embedding_claimed_at < NOW() - INTERVAL '30 minutes'
  );

UPDATE articles
SET clustering_claimed_at = NULL
WHERE clustering_claimed_at IS NOT NULL
  AND (
    story_id IS NOT NULL
    OR clustering_claimed_at < NOW() - INTERVAL '30 minutes'
  );

UPDATE stories
SET assembly_claimed_at = NULL
WHERE assembly_claimed_at IS NOT NULL
  AND (
    assembly_status != 'processing'
    OR assembly_claimed_at < NOW() - INTERVAL '60 minutes'
  );
