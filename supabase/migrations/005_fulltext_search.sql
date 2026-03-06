-- Add tsvector column for full-text search
ALTER TABLE stories ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Trigger function: auto-populate on INSERT/UPDATE
-- Headline = weight A (higher rank), AI summary text = weight B
CREATE OR REPLACE FUNCTION stories_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.headline, '')), 'A') ||
    setweight(to_tsvector('english',
      coalesce(NEW.ai_summary->>'commonGround', '') || ' ' ||
      coalesce(NEW.ai_summary->>'leftFraming', '') || ' ' ||
      coalesce(NEW.ai_summary->>'rightFraming', '')
    ), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS stories_search_vector_trigger ON stories;
CREATE TRIGGER stories_search_vector_trigger
  BEFORE INSERT OR UPDATE OF headline, ai_summary ON stories
  FOR EACH ROW EXECUTE FUNCTION stories_search_vector_update();

-- Backfill existing rows
UPDATE stories SET search_vector =
  setweight(to_tsvector('english', coalesce(headline, '')), 'A') ||
  setweight(to_tsvector('english',
    coalesce(ai_summary->>'commonGround', '') || ' ' ||
    coalesce(ai_summary->>'leftFraming', '') || ' ' ||
    coalesce(ai_summary->>'rightFraming', '')
  ), 'B');

-- GIN index for fast full-text queries
CREATE INDEX IF NOT EXISTS idx_stories_search_vector ON stories USING gin(search_vector);
