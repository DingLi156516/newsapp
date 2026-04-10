/**
 * Tests for lib/pipeline/retry-policy.ts — exponential backoff + DLQ
 * escalation.
 */

import { describe, it, expect } from 'vitest'
import {
  nextAttemptAfter,
  computeRetryOutcome,
  RETRY_BUDGET,
} from '@/lib/pipeline/retry-policy'

const FROZEN_NOW = new Date('2026-03-22T12:00:00Z')

describe('nextAttemptAfter', () => {
  it('returns base delay (60s) on the first retry with zero jitter', () => {
    const next = nextAttemptAfter(0, FROZEN_NOW, () => 0.5) // jitter = 0
    expect(next.getTime() - FROZEN_NOW.getTime()).toBe(60_000)
  })

  it('doubles the delay for each retry level', () => {
    const r0 = nextAttemptAfter(0, FROZEN_NOW, () => 0.5)
    const r1 = nextAttemptAfter(1, FROZEN_NOW, () => 0.5)
    const r2 = nextAttemptAfter(2, FROZEN_NOW, () => 0.5)

    expect(r0.getTime() - FROZEN_NOW.getTime()).toBe(60_000)
    expect(r1.getTime() - FROZEN_NOW.getTime()).toBe(120_000)
    expect(r2.getTime() - FROZEN_NOW.getTime()).toBe(240_000)
  })

  it('caps delay at 1 hour', () => {
    // 60s × 2^10 = 61440s, way above the 1h (3600s) cap.
    const next = nextAttemptAfter(10, FROZEN_NOW, () => 0.5)
    const delayMs = next.getTime() - FROZEN_NOW.getTime()
    // With zero jitter, the result should equal the cap exactly.
    expect(delayMs).toBe(60 * 60 * 1000)
  })

  it('applies positive jitter (rand=1.0 → +25%)', () => {
    const next = nextAttemptAfter(0, FROZEN_NOW, () => 1.0)
    const delayMs = next.getTime() - FROZEN_NOW.getTime()
    expect(delayMs).toBe(75_000) // 60_000 × 1.25
  })

  it('applies negative jitter (rand=0.0 → -25%)', () => {
    const next = nextAttemptAfter(0, FROZEN_NOW, () => 0.0)
    const delayMs = next.getTime() - FROZEN_NOW.getTime()
    expect(delayMs).toBe(45_000) // 60_000 × 0.75
  })
})

describe('computeRetryOutcome', () => {
  it('marks exhausted=false while below the stage budget', () => {
    for (let i = 0; i < RETRY_BUDGET.embed; i++) {
      const outcome = computeRetryOutcome('embed', i, FROZEN_NOW, () => 0.5)
      expect(outcome.exhausted).toBe(false)
      expect(outcome.nextRetryCount).toBe(i + 1)
    }
  })

  it('marks exhausted=true when the next retry exceeds the budget', () => {
    const outcome = computeRetryOutcome('embed', RETRY_BUDGET.embed, FROZEN_NOW, () => 0.5)
    expect(outcome.exhausted).toBe(true)
    expect(outcome.nextRetryCount).toBe(RETRY_BUDGET.embed + 1)
  })

  it('uses a smaller budget for assembly (3) than embed (5)', () => {
    // One retry past the assemble budget → exhausted
    const exhausted = computeRetryOutcome('assemble', RETRY_BUDGET.assemble, FROZEN_NOW, () => 0.5)
    expect(exhausted.exhausted).toBe(true)

    // Same retry count is NOT exhausted under the embed budget
    const stillRetrying = computeRetryOutcome('embed', RETRY_BUDGET.assemble, FROZEN_NOW, () => 0.5)
    expect(stillRetrying.exhausted).toBe(false)
  })

  it('returns a deterministic backoff given frozen time+rand', () => {
    const a = computeRetryOutcome('embed', 2, FROZEN_NOW, () => 0.5)
    const b = computeRetryOutcome('embed', 2, FROZEN_NOW, () => 0.5)
    expect(a.nextAttemptAt.toISOString()).toBe(b.nextAttemptAt.toISOString())
  })
})
