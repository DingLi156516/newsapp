/**
 * lib/pipeline/stage-events.ts — Stage event emitter contract.
 *
 * Pipeline stages (embed/cluster/assemble/recluster) receive an optional
 * emitter that records structured warn/error events to the
 * pipeline_stage_events table, keyed by the run_id + claim_owner. This
 * gives operators a drill-down view of what happened inside a specific
 * run that a pipeline_runs.steps summary cannot.
 *
 * See:
 *   - supabase/migrations/044_pipeline_stage_events.sql (schema)
 *   - lib/pipeline/logger.ts (makeStageEmitter factory)
 *   - app/api/admin/pipeline/events/route.ts (read endpoint)
 *   - docs/architecture.md — Observability
 */

export type StageKind = 'ingest' | 'embed' | 'cluster' | 'assemble' | 'recluster'

export type StageLevel = 'debug' | 'info' | 'warn' | 'error'

export interface StageEventInput {
  readonly stage: StageKind
  readonly level: StageLevel
  readonly eventType: string
  readonly sourceId?: string
  readonly provider?: string
  readonly itemId?: string
  readonly durationMs?: number
  readonly payload?: Record<string, unknown>
}

/**
 * Pre-bound to a runId + claimOwner by logger.makeStageEmitter(). Stage
 * functions call this directly; the binding is created once per run.
 */
export type StageEventEmitter = (event: StageEventInput) => Promise<void>

/**
 * No-op emitter. Use as a default when stages are invoked outside of a
 * pipeline run (tests, manual scripts) so stage code can call
 * `emitter(...)` unconditionally without `?.`.
 */
export const noopStageEmitter: StageEventEmitter = async () => {
  /* intentional no-op */
}

/**
 * Invoke a stage emitter while guaranteeing it never throws / rejects.
 *
 * `StageEventEmitter` is a bare function type, so nothing at the type
 * level prevents a caller from passing in a throwing/rejecting emitter
 * (tests, ad-hoc scripts, future call sites). Stage code must never let
 * observability failure stall a pipeline run, so every call site wraps
 * the emit through this helper instead of calling the emitter directly.
 *
 * `PipelineLogger.stageEvent` is already best-effort, so wrapping its
 * emitter with `safeEmit` is a no-op in the common case — but it keeps
 * the contract enforced at the call site regardless of which emitter
 * got passed in.
 */
export async function safeEmit(
  emitter: StageEventEmitter,
  input: StageEventInput
): Promise<void> {
  try {
    await emitter(input)
  } catch (err) {
    console.warn(
      `[stage-events] emitter threw: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Canonical event types emitted by the Phase 9 + Phase 10 pipeline.
 *
 * The `eventType` field on `StageEventInput` is free-text, so this list
 * is the source of truth for what operators should expect to see in the
 * `pipeline_stage_events` table and the `/admin/pipeline` Events panel:
 *
 *   pgvector_fallback        — cluster/recluster RPC outage; JS brute-force
 *                              engaged. One event per call (not per item).
 *   retry_count_read_failed  — could not read clustering_retry_count
 *   dlq_pushed               — terminal failure; entry written to
 *                              pipeline_dead_letter
 *   embedding_write_failed   — bulk embed write error
 *   tag_extraction_failed    — post-assembly tag pipeline failed (non-fatal)
 *   cleanup_fallback_failed  — retry-treatment cleanup could not release claim
 *   ownership_moved          — owner-scoped stage write matched zero rows
 *                              because another worker re-claimed the item.
 *                              BENIGN — skip DLQ + version bump + follow-up.
 *                              Emitted by embeddings, clustering, and
 *                              story-assembler at info level (Phase 10).
 *                              Payload: { phase, previousOwner }
 *
 * Phase 10 also introduces a LOUD failure mode that is NOT emitted as a
 * stage event but throws a tagged Error: `[<stage>/policy_drift]`. This
 * fires when an owner-scoped write matches zero rows AND the verify-read
 * shows the claim is still ours — a schema/RLS regression. Operators
 * should grep cron logs for `\[(embed|assemble|cluster)/policy_drift\]`.
 */

/*
 * NOTE on the Phase 7b cleanup fallback (lib/ai/clustering.ts:1486-1726):
 * the original count+verify implementation that runOwnerScopedUpdate
 * extracts is intentionally still inlined there because it lives in a
 * deeper error-recovery code path with different semantics. It has two
 * minor behavioral differences from the helper:
 *   1. It treats `count === undefined` (no error, no count) as a
 *      confirmed release without a verify-read, while the helper
 *      always verifies in that case.
 *   2. Row-missing / owner-moved diagnostics surface through the
 *      caller's `errors[]` array rather than the canonical
 *      `ownership_moved` info event.
 * Both behaviors are operationally tolerable for the cleanup-only
 * code path. Operators investigating cleanup-fallback drift should
 * grep for "fallback UPDATE" in cron logs, not the events panel.
 */
