/**
 * lib/bias-ratings/aggregator.ts — Consensus computation from multiple provider ratings.
 *
 * Uses median of numeric positions to resolve disagreements between providers.
 */

import type { BiasCategory, FactualityLevel } from '@/lib/types'
import type { ProviderRating, AggregatedRating } from '@/lib/bias-ratings/types'

const BIAS_SCALE: readonly BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]

const FACTUALITY_SCALE: readonly FactualityLevel[] = [
  'very-low', 'low', 'mixed', 'high', 'very-high',
]

function biasToNumeric(bias: BiasCategory): number {
  return BIAS_SCALE.indexOf(bias)
}

function numericToBias(n: number): BiasCategory {
  const clamped = Math.max(0, Math.min(BIAS_SCALE.length - 1, Math.round(n)))
  return BIAS_SCALE[clamped]
}

function factualityToNumeric(f: FactualityLevel): number {
  return FACTUALITY_SCALE.indexOf(f)
}

function numericToFactuality(n: number): FactualityLevel {
  const clamped = Math.max(0, Math.min(FACTUALITY_SCALE.length - 1, Math.round(n)))
  return FACTUALITY_SCALE[clamped]
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

export function aggregateRatings(ratings: readonly ProviderRating[]): AggregatedRating {
  const biasValues = ratings
    .filter((r) => r.bias !== null)
    .map((r) => biasToNumeric(r.bias!))

  const factualityValues = ratings
    .filter((r) => r.factuality !== null)
    .map((r) => factualityToNumeric(r.factuality!))

  const bias = biasValues.length === 0
    ? null
    : numericToBias(median(biasValues))

  const factuality = factualityValues.length === 0
    ? null
    : numericToFactuality(median(factualityValues))

  return {
    bias,
    factuality,
    providerCount: ratings.length,
    ratings,
  }
}
