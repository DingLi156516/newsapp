-- 042_phase_7b_remediation.sql
-- Phase 7b remediation of Codex adversarial review findings on Phases 2/7.
--
-- Fixes:
--   1. [HIGH] reprocess() wipes story content before the guarded requeue
--      can fail. Previously review-queries.ts committed the destructive
--      metadata reset BEFORE calling requeue_story_for_reassembly; if the
--      RPC returned false (active assembler or version mismatch) the caller
--      threw AFTER content had already been wiped. Now the content wipe
--      happens inside the guarded UPDATE so it is all-or-nothing.
--
--   2. [HIGH] Manual reprocess left assembly_retry_count /
--      assembly_next_attempt_at / assembly_last_error untouched. After
--      retry exhaustion the assembler sets next_attempt_at to a far-future
--      date (2099) and the claim RPC skips anything inside its backoff
--      window, so an admin could reprocess a story and never have it
--      re-claimed. The new RPC unconditionally clears retry metadata on
--      every successful requeue so exhausted stories become claimable
--      again regardless of which path requeued them (admin reprocess,
--      merge/split recluster, DLQ replay).
--
-- Because we are adding a parameter (p_clear_content), we drop the old
-- 2-arg function first and create the new 3-arg version. All TypeScript
-- callers pass the new argument explicitly.

DROP FUNCTION IF EXISTS requeue_story_for_reassembly(UUID, INTEGER);

CREATE OR REPLACE FUNCTION requeue_story_for_reassembly(
  p_story_id UUID,
  p_expected_version INTEGER,
  p_clear_content BOOLEAN DEFAULT FALSE
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
    -- Always clear retry/backoff. Exhausted stories must become claimable
    -- again on every legitimate requeue path; otherwise the FAR_FUTURE
    -- next_attempt_at written by story-assembler.ts during exhaustion would
    -- shadow this story forever (Codex finding 2).
    assembly_retry_count = 0,
    assembly_next_attempt_at = NULL,
    assembly_last_error = NULL,
    -- Optional content wipe — used by admin manual reprocess. The entire
    -- reset runs inside this single UPDATE so either every field moves
    -- together or nothing moves at all (Codex finding 1).
    headline = CASE WHEN p_clear_content
      THEN 'Pending headline generation'
      ELSE headline
    END,
    ai_summary = CASE WHEN p_clear_content
      THEN jsonb_build_object(
        'commonGround', '',
        'leftFraming', '',
        'rightFraming', ''
      )
      ELSE ai_summary
    END,
    assembled_at = CASE WHEN p_clear_content THEN NULL ELSE assembled_at END,
    processing_error = CASE WHEN p_clear_content THEN NULL ELSE processing_error END,
    confidence_score = CASE WHEN p_clear_content THEN NULL ELSE confidence_score END,
    reviewed_by = CASE WHEN p_clear_content THEN NULL ELSE reviewed_by END,
    reviewed_at = CASE WHEN p_clear_content THEN NULL ELSE reviewed_at END,
    assembly_version = stories.assembly_version + 1,
    last_updated = now()
  WHERE id = p_story_id
    AND assembly_status != 'processing'
    AND assembly_version = p_expected_version;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION requeue_story_for_reassembly(UUID, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION requeue_story_for_reassembly(UUID, INTEGER, BOOLEAN) TO service_role;
