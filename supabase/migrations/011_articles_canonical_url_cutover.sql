-- Migration 011: Complete the article identity cutover from raw url uniqueness to canonical_url uniqueness.

UPDATE articles
SET canonical_url = COALESCE(canonical_url, url)
WHERE canonical_url IS NULL;

ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS articles_url_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_canonical_url_unique ON articles(canonical_url);
