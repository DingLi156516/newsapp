/**
 * lib/ai/centroid-weights.ts — Weighted-centroid helpers for clustering.
 *
 * Pure functions used to bias the cluster centroid toward high-factuality and
 * recent articles, so an incoming story's direction in embedding space is set
 * by the most trustworthy and freshest reporting in the cluster rather than by
 * an unweighted average where one low-factuality 48h-old article has the same
 * pull as a very-high-factuality article published minutes ago.
 *
 * Constants are intentionally hard-coded (not env-tunable) so the clustering
 * behavior stays reproducible in tests and in CI. Revisit the numbers if
 * clustering quality benchmarking ever provides evidence for a different
 * trade-off; don't add a configuration surface speculatively.
 *
 * Chosen values:
 *   - FACTUALITY_WEIGHTS: 0.5 → 1.5 across five levels. The 3:1 spread between
 *     very-low and very-high is large enough to matter without being so large
 *     that a single very-high source can single-handedly override a cluster of
 *     moderate ones.
 *   - TIME_DECAY_HALF_LIFE_MS: 24 hours. News stories are strongly time-boxed
 *     by daily cycles; a 24h half-life means yesterday's articles contribute
 *     half as much as today's, and anything older than ~72h contributes <13%.
 */

import type { FactualityLevel } from '@/lib/types'

export const FACTUALITY_WEIGHTS: Record<FactualityLevel, number> = {
  'very-high': 1.5,
  'high': 1.25,
  'mixed': 1.0,
  'low': 0.75,
  'very-low': 0.5,
}

export const TIME_DECAY_HALF_LIFE_MS = 24 * 60 * 60 * 1000

const LN2 = Math.log(2)

/**
 * Multiplier for an article's contribution to a centroid based on its source's
 * factuality rating. Higher factuality → greater pull on the centroid.
 */
export function factualityWeight(level: FactualityLevel): number {
  return FACTUALITY_WEIGHTS[level]
}

/**
 * Multiplier for an article's contribution to a centroid based on how long ago
 * it was published. Follows exponential decay with a 24h half-life by default
 * (overridable for tests). Future timestamps are clamped to weight 1 — clock
 * skew between ingestion and the DB should not produce negative ages.
 */
export function timeDecayWeight(
  publishedAt: Date,
  now: Date,
  halfLifeMs: number = TIME_DECAY_HALF_LIFE_MS,
): number {
  const ageMs = Math.max(0, now.getTime() - publishedAt.getTime())
  return Math.exp(-LN2 * ageMs / halfLifeMs)
}

/**
 * Full per-article weight = factuality × time-decay. An article with
 * `very-high` factuality published right now contributes 1.5× to the centroid;
 * a `very-low` article from yesterday contributes 0.25×.
 */
export function combinedWeight(
  level: FactualityLevel,
  publishedAt: Date,
  now: Date,
): number {
  return factualityWeight(level) * timeDecayWeight(publishedAt, now)
}
