-- Migration 053: story_views — anonymous engagement telemetry.
--
-- Phase 3 of the Ground-News parity roadmap: capture per-story view, dwell,
-- read-through and share events from web + mobile so ranking can reward
-- stories that readers actually engage with — not just stories that the
-- editorial signals (impact, velocity, diversity) score highly.
--
-- Privacy contract:
--   * No IP, no User-Agent, no viewport, no raw referrer URL stored.
--   * `session_id` is an opaque UUID v4 generated client-side and rotated
--     every 7 days (web: httpOnly cookie; mobile: expo-secure-store entry).
--     The server does not derive it from any per-user identifier.
--   * `referrer_kind` is a 5-value enum, not a URL — gives ranking the
--     "how did they land here?" signal without leaking session state.
--   * `dwell_bucket` is a 0..3 bucket, not a millisecond duration — bucketing
--     reduces uniqueness so two readers spending 47s vs. 53s look identical.
--   * RLS: SELECT is admin-only; INSERT is restricted to the service
--     role. Consent + dedupe + validation live in the /api/events/story
--     route, which writes via the service-role client. anon and
--     authenticated roles cannot insert directly through PostgREST,
--     so a leaked anon key cannot be used to forge engagement rows.

CREATE TABLE story_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id        UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id         UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('view', 'dwell', 'read_through', 'share')),
  dwell_bucket    SMALLINT NULL CHECK (dwell_bucket BETWEEN 0 AND 3),
  referrer_kind   TEXT NULL CHECK (referrer_kind IN ('feed', 'for_you', 'search', 'direct', 'external')),
  client          TEXT NOT NULL CHECK (client IN ('web', 'mobile')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read-path indexes.
--   * `(story_id, created_at DESC)` powers per-story unique-viewer rollups
--     (Hot Now, engagement_factor refresh) — the trending refresh's hot
--     query is "events for story X in last 6h".
--   * `(user_id, created_at DESC)` partial powers For-You's read-similar
--     bonus — only authenticated users contribute to the user_id arm.
--   * `(story_id, action, created_at DESC)` is the recent-engagement
--     lookup. We deliberately *do not* use a `WHERE created_at > now() -
--     interval '24h'` predicate — `now()` is STABLE not IMMUTABLE, which
--     makes Postgres refuse the partial index. The full composite costs
--     a few KB of index per million rows and the planner picks it
--     correctly when the query already filters on action + recent
--     created_at.
CREATE INDEX idx_story_views_story_created
  ON story_views (story_id, created_at DESC);

CREATE INDEX idx_story_views_user_created
  ON story_views (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_story_views_story_action_created
  ON story_views (story_id, action, created_at DESC);

-- Global engagement scans: `queryTopEngagedStories` (Hot Now) and the
-- `refresh_trending_scores()` CTE both filter by `action = 'view'` AND
-- recent `created_at` with no story_id constraint. The
-- (story_id, action, created_at) index above cannot serve those scans
-- because the leading column is unfiltered, so without this index both
-- paths would devolve to sequential scans as story_views grows — which
-- would hit the 30-second statement_timeout inside the trending refresh.
CREATE INDEX idx_story_views_action_created
  ON story_views (action, created_at DESC);

-- Server-side dedup. Same session, same story, same action within the same
-- minute collapses to one row via INSERT ... ON CONFLICT DO NOTHING.
-- `date_trunc(text, timestamptz)` is STABLE (depends on session TZ), so
-- we coerce to UTC first via `AT TIME ZONE 'UTC'` — the result is a plain
-- `timestamp without time zone`, and `date_trunc(text, timestamp)` is
-- IMMUTABLE, which is what Postgres requires for an index expression.
-- Excludes 'dwell' and 'share' which legitimately fire multiple times
-- per session.
CREATE UNIQUE INDEX idx_story_views_session_dedupe
  ON story_views (
    session_id,
    story_id,
    action,
    (date_trunc('minute', (created_at AT TIME ZONE 'UTC')))
  )
  WHERE action IN ('view', 'read_through');

-- RLS: insert path is restricted to the service role. The
-- /api/events/story route enforces consent + Zod + dedupe and writes via
-- the service-role client. We deliberately do NOT grant insert to anon
-- or authenticated — anyone with the public anon key could otherwise
-- POST directly to PostgREST and forge `session_id`/`user_id` rows,
-- bypassing every consent and rate-limit check above.
-- SELECT is locked to admins so analyst access remains auditable via
-- the admin_users table.
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY story_views_service_insert ON story_views
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY story_views_admin_read ON story_views
  FOR SELECT
  USING (is_admin());
