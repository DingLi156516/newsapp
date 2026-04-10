-- 038_assembly_version_guard.sql
-- Guarded reassembly transitions via assembly_version compare-and-set.
--
-- Problem: queueStoryForReassembly and the recluster merge/split paths
-- unconditionally reset assembly_status='pending' + clear the claim, even
-- if an assembler was currently assembly_status='processing' on the same
-- story. This stomped an active assembler's in-flight work.
--
-- This migration adds:
--   - assembly_version INTEGER on stories (compare-and-set token)
--   - requeue_story_for_reassembly(story_id, expected_version) RPC that
--     only resets a story when it is NOT currently processing AND the
--     caller's version matches. Bumps assembly_version on success.
--
-- Callers read the current version, call the RPC, and if the RPC returns
-- FALSE they log a soft "guarded" event and skip — the running assembler
-- will see the new state on its next pass.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS assembly_version INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- requeue_story_for_reassembly — guarded reset
-- ---------------------------------------------------------------------------
-- Returns true if the story was successfully requeued. Returns false if:
--   - the story is currently assembly_status='processing', OR
--   - the expected_version no longer matches (another requeue won the race)
-- On success, assembly_version is incremented so any concurrent requeue
-- attempt will also see a version mismatch.

CREATE OR REPLACE FUNCTION requeue_story_for_reassembly(
  p_story_id UUID,
  p_expected_version INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE stories
  SET
    assembly_status = 'pending',
    publication_status = 'draft',
    review_status = 'pending',
    review_reasons = '{}',
    published_at = NULL,
    assembly_claimed_at = NULL,
    assembly_claim_owner = NULL,
    assembly_version = stories.assembly_version + 1,
    last_updated = now()
  WHERE id = p_story_id
    AND assembly_status != 'processing'
    AND assembly_version = p_expected_version;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- bump_assembly_version — increments the version without changing state
-- ---------------------------------------------------------------------------
-- Called by the story assembler on success/failure transitions so any
-- concurrent requeue caller that already captured the old version will see
-- a version mismatch and skip its stale requeue attempt.

CREATE OR REPLACE FUNCTION bump_assembly_version(p_story_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE stories
  SET assembly_version = stories.assembly_version + 1
  WHERE id = p_story_id;
END;
$$;

REVOKE ALL ON FUNCTION requeue_story_for_reassembly(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION bump_assembly_version(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION requeue_story_for_reassembly(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION bump_assembly_version(UUID) TO service_role;
