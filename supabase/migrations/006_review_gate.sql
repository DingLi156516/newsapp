-- 006_review_gate.sql — Admin review gate for AI-generated summaries.
--
-- Adds an admin_users table and review columns on stories so that
-- AI-generated content must be approved before appearing in the public feed.

-- ---------------------------------------------------------------------------
-- 1. admin_users table
-- ---------------------------------------------------------------------------

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);

-- RLS: service_role writes; authenticated users can read own row
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users_read_own" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Review columns on stories
-- ---------------------------------------------------------------------------

ALTER TABLE stories ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE stories ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE stories ADD COLUMN reviewed_at TIMESTAMPTZ;

CREATE INDEX idx_stories_review_status ON stories(review_status);

-- ---------------------------------------------------------------------------
-- 3. Helper function: is_admin()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 4. Updated RLS policies on stories
-- ---------------------------------------------------------------------------

-- Drop existing read policy and replace with one that hides non-approved
-- stories from regular users while allowing admins to see everything.
DROP POLICY IF EXISTS "stories_read" ON stories;

CREATE POLICY "stories_read" ON stories FOR SELECT
  USING (review_status = 'approved' OR is_admin());

-- Allow admins to update stories (approve, reject, edit headline/summary).
CREATE POLICY "stories_admin_update" ON stories FOR UPDATE
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- 5. Backfill: approve all existing stories that already have headlines
-- ---------------------------------------------------------------------------

UPDATE stories SET review_status = 'approved'
  WHERE headline != 'Pending headline generation';
