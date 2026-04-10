-- 043_atomic_clustering_failure.sql
-- Phase 7b.7 remediation of a Codex adversarial-review finding against
-- commit 65a38233.
--
-- Problem: handleClusteringFailure in lib/ai/clustering.ts did two
-- separate writes for an exhausted article — an owner-scoped UPDATE on
-- the article row followed by an INSERT into pipeline_dead_letter. If
-- the worker crashed between them (or the network call for the INSERT
-- failed after the UPDATE commit), the article was left in:
--
--   clustering_status = 'failed'
--   clustering_next_attempt_at = '2099-01-01'
--   clustering_claim_owner = NULL
--
-- which permanently excludes it from the claim RPC, AND there was no
-- DLQ row for operators to replay. Silent stranding with no recovery
-- path.
--
-- This migration introduces apply_clustering_failure, a SECURITY
-- DEFINER function that performs the guarded UPDATE and (when
-- exhausted) the DLQ INSERT inside a single transaction. If either
-- write fails the transaction rolls back and the article is left in
-- its previous pending state so a subsequent run can retry normally.
--
-- The UPDATE is owner-scoped (clustering_claim_owner = p_owner) so a
-- stale worker whose claim has already been reclaimed cannot stomp
-- the newer worker's state — matching the 7b.6 fix in clustering.ts.

CREATE OR REPLACE FUNCTION apply_clustering_failure(
  p_article_id UUID,
  p_owner UUID,
  p_retry_count INTEGER,
  p_next_attempt_at TIMESTAMPTZ,
  p_last_error TEXT,
  p_exhausted BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE articles
  SET
    clustering_retry_count = p_retry_count,
    clustering_next_attempt_at = p_next_attempt_at,
    clustering_last_error = p_last_error,
    clustering_claimed_at = NULL,
    clustering_claim_owner = NULL,
    clustering_status = CASE WHEN p_exhausted THEN 'failed' ELSE 'pending' END
  WHERE id = p_article_id
    AND clustering_claim_owner = p_owner;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Owner changed under us: a different worker reclaimed this row
  -- while we were processing. Leave their state alone — they own the
  -- retry budget and DLQ escalation from here.
  IF v_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- Atomic DLQ insert inside the same transaction. If the caller or
  -- the DB crashes between these two statements the UPDATE rolls back
  -- too, so the article stays in its original pending state and a
  -- later pass can retry cleanly.
  IF p_exhausted THEN
    INSERT INTO pipeline_dead_letter (item_kind, item_id, retry_count, last_error)
    VALUES ('article_cluster', p_article_id, p_retry_count, p_last_error);
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION apply_clustering_failure(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_clustering_failure(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT, BOOLEAN) TO service_role;
