/**
 * Tests for lib/pipeline/batch-tuner.ts — adaptive EMA-based batch sizing.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  recommendBatchSize,
  fetchRecentStageDurations,
  STAGE_BUDGETS,
  type StageBudget,
} from '@/lib/pipeline/batch-tuner'

const EMBED_BUDGET: StageBudget = STAGE_BUDGETS.embed

describe('recommendBatchSize', () => {
  it('returns the previous batch size when no history exists', () => {
    const result = recommendBatchSize('embed', [], 100, EMBED_BUDGET)
    expect(result.recommendedBatch).toBe(100)
    expect(result.reason).toBe('no_history')
  })

  it('shrinks when the EMA exceeds the target budget', () => {
    // Three runs all ~30s (target is 15s) → shrink
    const durations = [30_000, 30_000, 30_000]
    const result = recommendBatchSize('embed', durations, 200, EMBED_BUDGET)
    expect(result.reason).toBe('over_budget')
    expect(result.recommendedBatch).toBeLessThan(200)
    expect(result.recommendedBatch).toBeGreaterThanOrEqual(EMBED_BUDGET.min)
  })

  it('respects the minimum floor on aggressive shrinks', () => {
    // Extreme over-budget: target 15s, observed 5 minutes. Shrink ratio
    // would go below min; the result must clamp to the floor.
    const durations = [300_000, 300_000]
    const result = recommendBatchSize('embed', durations, 100, EMBED_BUDGET)
    expect(result.recommendedBatch).toBe(EMBED_BUDGET.min)
  })

  it('grows when well under budget and below ceiling', () => {
    // Three runs at 5s each (target 15s; 5 < 0.6*15=9) → grow
    const durations = [5_000, 5_000, 5_000]
    const result = recommendBatchSize('embed', durations, 100, EMBED_BUDGET)
    expect(result.reason === 'under_budget' || result.reason === 'at_ceiling').toBe(true)
    expect(result.recommendedBatch).toBeGreaterThan(100)
    expect(result.recommendedBatch).toBeLessThanOrEqual(EMBED_BUDGET.ceiling)
  })

  it('does not grow beyond the ceiling', () => {
    const durations = [2_000, 2_000, 2_000]
    const result = recommendBatchSize('embed', durations, EMBED_BUDGET.ceiling, EMBED_BUDGET)
    expect(result.recommendedBatch).toBe(EMBED_BUDGET.ceiling)
  })

  it('leaves the batch stable when inside the ±budget sweet spot', () => {
    // Observed ~12s per pass, target 15s → inside sweet spot, stable
    const durations = [12_000, 12_000, 12_000]
    const result = recommendBatchSize('embed', durations, 150, EMBED_BUDGET)
    expect(result.recommendedBatch).toBe(150)
  })

  it('weights recent observations more than old ones (EMA)', () => {
    // Old runs were fast; most recent runs are slow. EMA should lean
    // towards the slow side and trigger a shrink.
    const durations = [60_000, 50_000, 5_000, 5_000, 5_000]
    // Note: fetchRecentStageDurations returns newest-first, so index 0 is
    // the most recent. Here [60_000, ...] is "newest 60s".
    const result = recommendBatchSize('embed', durations, 200, EMBED_BUDGET)
    expect(result.reason).toBe('over_budget')
  })
})

describe('fetchRecentStageDurations', () => {
  function createMockClient(runs: Array<{ steps: unknown }>) {
    const limitMock = vi.fn().mockResolvedValue({ data: runs, error: null })
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })

    return {
      from: vi.fn(() => ({ select: selectMock })),
    }
  }

  it('extracts durations for the matching stage prefix', async () => {
    const client = createMockClient([
      {
        steps: [
          { step: 'embed_pass_1', duration_ms: 12_000 },
          { step: 'cluster_pass_1', duration_ms: 20_000 },
        ],
      },
      {
        steps: [
          { step: 'embed_pass_1', duration_ms: 14_000 },
          { step: 'embed_pass_2', duration_ms: 9_000 },
        ],
      },
    ])

    const result = await fetchRecentStageDurations(client as never, 'embed_pass_', 5)
    expect(result).toEqual([12_000, 14_000, 9_000])
  })

  it('returns [] on query error', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
            })),
          })),
        })),
      })),
    }

    const result = await fetchRecentStageDurations(client as never, 'embed_pass_', 5)
    expect(result).toEqual([])
  })

  it('ignores non-matching stage prefixes within the same run', async () => {
    const client = createMockClient([
      {
        steps: [
          { step: 'cluster_pass_1', duration_ms: 1 },
          { step: 'assemble_pass_1', duration_ms: 2 },
        ],
      },
    ])

    const result = await fetchRecentStageDurations(client as never, 'embed_pass_', 5)
    expect(result).toEqual([])
  })
})
