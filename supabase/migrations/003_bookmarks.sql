-- Phase 5A: Bookmarks + Reading History tables

-- bookmarks table
CREATE TABLE bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, story_id)
);

-- reading_history table (created now, used in Phase 5B)
CREATE TABLE reading_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read     BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, story_id)
);

-- Indexes
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_story_id ON bookmarks(story_id);
CREATE INDEX idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX idx_reading_history_story_id ON reading_history(story_id);
CREATE INDEX idx_reading_history_read_at ON reading_history(read_at DESC);

-- RLS
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_select" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookmarks_insert" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookmarks_delete" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "reading_history_select" ON reading_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reading_history_insert" ON reading_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reading_history_delete" ON reading_history
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "reading_history_update" ON reading_history
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
