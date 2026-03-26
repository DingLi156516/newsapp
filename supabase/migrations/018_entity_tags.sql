-- 018_entity_tags.sql — Many-to-many entity tagging for stories.
--
-- Adds `tags` (deduplicated entities) and `story_tags` (join table with relevance).
-- Tag types: person, organization, location, event, topic.
-- Trigger maintains denormalized story_count on tags.

-- ---------------------------------------------------------------------------
-- tags table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  tag_type    TEXT NOT NULL CHECK (tag_type IN ('person', 'organization', 'location', 'event', 'topic')),
  story_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tags_slug ON tags (slug);
CREATE INDEX idx_tags_tag_type ON tags (tag_type);
CREATE INDEX idx_tags_story_count_desc ON tags (story_count DESC);

-- ---------------------------------------------------------------------------
-- story_tags join table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS story_tags (
  story_id  UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  relevance REAL NOT NULL DEFAULT 1.0 CHECK (relevance >= 0 AND relevance <= 1),
  PRIMARY KEY (story_id, tag_id)
);

CREATE INDEX idx_story_tags_story_id ON story_tags (story_id);
CREATE INDEX idx_story_tags_tag_id ON story_tags (tag_id);
CREATE INDEX idx_story_tags_relevance_desc ON story_tags (relevance DESC);

-- ---------------------------------------------------------------------------
-- Trigger: maintain tags.story_count on INSERT/DELETE of story_tags
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_tag_story_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET story_count = story_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET story_count = story_count - 1 WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tag_story_count
AFTER INSERT OR DELETE ON story_tags
FOR EACH ROW
EXECUTE FUNCTION update_tag_story_count();

-- ---------------------------------------------------------------------------
-- RLS: public read, service_role write (same pattern as stories/articles)
-- ---------------------------------------------------------------------------

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_public_read" ON tags
  FOR SELECT USING (true);

CREATE POLICY "tags_service_write" ON tags
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "story_tags_public_read" ON story_tags
  FOR SELECT USING (true);

CREATE POLICY "story_tags_service_write" ON story_tags
  FOR ALL USING (auth.role() = 'service_role');
