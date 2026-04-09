-- Migration 033: Partial B-tree index on title_fingerprint for embedding cache lookups.
-- Syndicated wire stories (AP/Reuters) share titles across sources. This index
-- lets the embed stage copy existing embeddings instead of calling Gemini again.

CREATE INDEX IF NOT EXISTS idx_articles_title_fingerprint
  ON articles(title_fingerprint)
  WHERE title_fingerprint IS NOT NULL AND is_embedded = true;
