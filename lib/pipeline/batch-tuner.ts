/**
 * lib/pipeline/batch-tuner.ts — Adaptive batch sizing for pipeline stages.
 *
 * The process pipeline has three stages (embed, cluster, assemble) each
 * driven by a fixed batch-size constant. Under load those constants either
 * starve the stage (too small) or burn through the cron time budget on a
 * single slow pass (too large). This module keeps an EMA of the last 5
 * stage wall-times from the `pipeline_runs.steps` audit table and shrinks
 * or grows the next batch towards a target budget.
 *
 * The output is a CEILING — callers pass MIN/MAX bounds and the tuner
 * returns a value inside that range. Env-var configured defaults remain
 * the hard maximum; the tuner can never recommend a larger value than
 * the caller's `ceiling`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type StageKind = 'embed' | 'cluster' | 'assemble'

export interface StageBudget {
  /** Absolute floor — never recommend a value below this. */
  readonly min: number
  /** Absolute ceiling — env-var default, never recommend above this. */
  readonly ceiling: number
  /** Target wall-time per pass in ms. Shrink when we breach this. */
  readonly targetMs: number
  /** The stage prefix used in pipeline_runs.steps (e.g. "embed_pass_"). */
  readonly stepPrefix: string
}

export interface StageRecommendation {
  readonly stage: StageKind
  readonly recommendedBatch: number
  readonly reason: 'no_history' | 'under_budget' | 'over_budget' | 'at_ceiling'
  readonly emaMs: number
}

const EMA_ALPHA = 0.4 // weight on most-recent observation
const HISTORY_LIMIT = 5

function computeEma(durations: readonly number[]): number {
  if (durations.length === 0) return 0
  // Initialise from the oldest observation, fold newer ones in.
  const ordered = [...durations].reverse() // oldest first
  let ema = ordered[0]
  for (let i = 1; i < ordered.length; i++) {
    ema = EMA_ALPHA * ordered[i] + (1 - EMA_ALPHA) * ema
  }
  return ema
}

/**
 * Read the last N completed pipeline_runs and extract the wall-time of
 * the named stage from each run's `steps` JSON payload. Only completed
 * runs are considered (no in-progress or failed).
 */
export async function fetchRecentStageDurations(
  client: SupabaseClient<Database>,
  stepPrefix: string,
  limit: number = HISTORY_LIMIT
): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('pipeline_runs') as any)
    .select('steps')
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  const durations: number[] = []
  for (const row of data as Array<{ steps: unknown }>) {
    const steps = row.steps
    if (!Array.isArray(steps)) continue
    for (const step of steps as Array<{ step?: string; duration_ms?: number }>) {
      if (step.step?.startsWith(stepPrefix) && typeof step.duration_ms === 'number') {
        durations.push(step.duration_ms)
      }
    }
  }

  return durations
}

/**
 * Given recent stage durations, return a batch-size recommendation within
 * the caller's `[min, ceiling]` bounds. Shrinks when the EMA exceeds the
 * target budget, grows when well under.
 */
export function recommendBatchSize(
  stage: StageKind,
  durations: readonly number[],
  previousBatch: number,
  budget: StageBudget
): StageRecommendation {
  const ema = computeEma(durations)

  if (durations.length === 0) {
    return {
      stage,
      recommendedBatch: previousBatch,
      reason: 'no_history',
      emaMs: 0,
    }
  }

  // Over budget: shrink towards min. Use duration ratio to scale smoothly.
  if (ema > budget.targetMs) {
    const ratio = budget.targetMs / ema
    const shrunk = Math.max(budget.min, Math.floor(previousBatch * ratio))
    return {
      stage,
      recommendedBatch: shrunk,
      reason: 'over_budget',
      emaMs: ema,
    }
  }

  // Well under budget (<= 60% of target): grow modestly towards ceiling.
  if (ema <= budget.targetMs * 0.6 && previousBatch < budget.ceiling) {
    const grown = Math.min(budget.ceiling, Math.ceil(previousBatch * 1.25))
    return {
      stage,
      recommendedBatch: grown,
      reason: grown >= budget.ceiling ? 'at_ceiling' : 'under_budget',
      emaMs: ema,
    }
  }

  return {
    stage,
    recommendedBatch: previousBatch,
    reason: ema >= budget.targetMs * 0.6 ? 'under_budget' : 'at_ceiling',
    emaMs: ema,
  }
}

/**
 * Canonical per-stage budgets. Referenced in docs/pipeline.md so the
 * numeric values live in one place.
 */
export const STAGE_BUDGETS: Record<StageKind, StageBudget> = {
  embed: {
    min: 25,
    ceiling: 200,
    targetMs: 15_000,
    stepPrefix: 'embed_pass_',
  },
  cluster: {
    min: 50,
    ceiling: 300,
    targetMs: 20_000,
    stepPrefix: 'cluster_pass_',
  },
  assemble: {
    min: 10,
    ceiling: 50,
    targetMs: 25_000,
    stepPrefix: 'assemble_pass_',
  },
}
