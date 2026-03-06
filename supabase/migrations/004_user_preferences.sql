-- Phase 5C: User preferences table

CREATE TABLE user_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_topics       TEXT[] NOT NULL DEFAULT '{}',
  default_region        TEXT NOT NULL DEFAULT 'us' CHECK (default_region IN (
                          'us','international','uk','canada','europe')),
  default_perspective   TEXT NOT NULL DEFAULT 'all' CHECK (default_perspective IN (
                          'all','left','center','right')),
  factuality_minimum    TEXT NOT NULL DEFAULT 'mixed' CHECK (factuality_minimum IN (
                          'very-high','high','mixed','low','very-low')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Reuse existing update_updated_at() trigger function from 001_initial_schema.sql
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
