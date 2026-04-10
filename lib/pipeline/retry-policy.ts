/**
 * lib/pipeline/retry-policy.ts — Exponential-backoff retry policy for
 * pipeline stages.
 *
 * When a stage (embed / cluster / assemble) fails on a single item, we
 * increment its retry_count and set next_attempt_at = now() + backoff.
 * The Phase 1 claim RPCs were extended in migration 041 to skip rows
 * whose backoff window has not yet elapsed. When retry_count exceeds
 * the per-stage budget, the caller moves the item to the DLQ table.
 *
 * Backoff: base 60s × 2^retry_count, ±25% jitter, capped at 1h.
 */

export type StageKind = 'embed' | 'cluster' | 'assemble'

export interface RetryOutcome {
  readonly exhausted: boolean
  readonly nextRetryCount: number
  readonly nextAttemptAt: Date
}

const BACKOFF_BASE_MS = 60 * 1000
const BACKOFF_FACTOR = 2
const BACKOFF_CAP_MS = 60 * 60 * 1000
const JITTER_SPREAD = 0.25

export const RETRY_BUDGET: Record<StageKind, number> = {
  embed: 5,
  cluster: 5,
  assemble: 3,
}

/**
 * Return the next attempt time for an item that just failed for the Nth
 * time (where retryCount is the *previous* count — this call is about to
 * increment it). Purely deterministic given `now` and `rand`; the
 * optional injection lets tests freeze both.
 */
export function nextAttemptAfter(
  retryCount: number,
  now: Date = new Date(),
  rand: () => number = Math.random
): Date {
  const uncappedDelay = BACKOFF_BASE_MS * Math.pow(BACKOFF_FACTOR, retryCount)
  const cappedDelay = Math.min(uncappedDelay, BACKOFF_CAP_MS)

  // Apply ±25% jitter. rand() ∈ [0, 1) → shift to [-0.25, 0.25).
  const jitter = (rand() * 2 - 1) * JITTER_SPREAD
  const jittered = Math.round(cappedDelay * (1 + jitter))

  return new Date(now.getTime() + jittered)
}

/**
 * Decide what to do after a stage failure on a single item. Returns an
 * `exhausted` flag that callers use to route the item to the DLQ.
 */
export function computeRetryOutcome(
  stage: StageKind,
  previousRetryCount: number,
  now: Date = new Date(),
  rand: () => number = Math.random
): RetryOutcome {
  const nextRetryCount = previousRetryCount + 1
  const exhausted = nextRetryCount > RETRY_BUDGET[stage]

  return {
    exhausted,
    nextRetryCount,
    nextAttemptAt: nextAttemptAfter(previousRetryCount, now, rand),
  }
}
