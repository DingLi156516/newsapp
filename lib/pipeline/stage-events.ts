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
