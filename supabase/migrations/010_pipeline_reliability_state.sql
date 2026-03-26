-- Migration 010: Explicit pipeline/publication state for stories and chunked processing claims.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS assembly_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (assembly_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'needs_review', 'published', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS assembled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assembly_claimed_at TIMESTAMPTZ;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS title_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS embedding_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clustering_claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stories_publication_status ON stories(publication_status);
CREATE INDEX IF NOT EXISTS idx_stories_assembly_status ON stories(assembly_status);
CREATE INDEX IF NOT EXISTS idx_articles_embedding_claimed_at ON articles(embedding_claimed_at);
CREATE INDEX IF NOT EXISTS idx_articles_clustering_claimed_at ON articles(clustering_claimed_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_canonical_url_unique ON articles(canonical_url);

UPDATE articles
SET canonical_url = COALESCE(canonical_url, url)
WHERE canonical_url IS NULL;

UPDATE stories
SET
  assembly_status = CASE
    WHEN review_status = 'pending' AND headline = 'Pending headline generation' THEN 'pending'
    ELSE 'completed'
  END,
  publication_status = CASE
    WHEN review_status = 'approved' THEN 'published'
    WHEN review_status = 'rejected' THEN 'rejected'
    WHEN review_status = 'pending' AND headline = 'Pending headline generation' THEN 'draft'
    ELSE 'needs_review'
  END,
  review_reasons = CASE
    WHEN review_status = 'pending' AND headline = 'Pending headline generation' THEN '[]'::jsonb
    WHEN review_status = 'pending' AND (ai_summary IS NULL OR ai_summary = '{}'::jsonb) THEN '["legacy_data_repair"]'::jsonb
    WHEN review_status = 'pending' THEN '["legacy_pending_review"]'::jsonb
    ELSE '[]'::jsonb
  END,
  assembled_at = CASE
    WHEN review_status = 'pending' AND headline = 'Pending headline generation' THEN NULL
    ELSE COALESCE(assembled_at, last_updated, first_published)
  END,
  published_at = CASE
    WHEN review_status = 'approved' THEN COALESCE(published_at, reviewed_at, last_updated, first_published)
    ELSE published_at
  END,
  processing_error = CASE
    WHEN review_status = 'pending' AND headline != 'Pending headline generation' AND (ai_summary IS NULL OR ai_summary = '{}'::jsonb)
      THEN COALESCE(processing_error, 'legacy_data_repair')
    ELSE processing_error
  END;

DROP POLICY IF EXISTS "stories_read" ON stories;

CREATE POLICY "stories_read" ON stories FOR SELECT
  USING (publication_status = 'published' OR is_admin());
