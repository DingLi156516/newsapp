/**
 * lib/api/trending-score.ts — Trending feed ranking (pure function).
 *
 * Composite score combining four existing story signals:
 *
 *   trending = impact_score
 *            × (1 + log10(max(articles_24h, 1)))    // velocity kicker
 *            × diversity_factor                      // 0.5 + 0.5 × normalized Shannon entropy
 *            × time_decay                            // 1 / (hours + 2)^gravity (HN-style)
 *
 * Gravity 1.5 gives a ~12h half-life, tunable via the `gravity` input.
 * `diversity_factor` rewards balanced coverage while keeping echo-chamber
 * stories rankable (never multiplies by zero).
 *
 * All inputs are already computed by the ingest pipeline; this module does
 * not touch the database. Callers pass plain numbers and ISO timestamps.
 */

import type { SpectrumSegment } from '@/lib/types'

export interface TrendingInputs {
  readonly impactScore: number
  readonly articles24h: number
  readonly spectrumSegments: readonly SpectrumSegment[]
  readonly publishedAt: string
  readonly now?: Date
  readonly gravity?: number
}

const DEFAULT_GRAVITY = 1.5
const TIME_OFFSET_HOURS = 2
const MS_PER_HOUR = 60 * 60 * 1000

/**
 * Normalized Shannon entropy of spectrum coverage, mapped to [0.5, 1].
 *
 *   H = -Σ p_i × log(p_i) / log(n)       where n = non-zero bucket count
 *   factor = 0.5 + 0.5 × H                so a single-bucket story gets 0.5,
 *                                         a perfectly balanced story gets 1.0.
 *
 * Empty/missing segments return 0.5 (neutral — no data to reward or punish).
 */
export function shannonDiversityFactor(
  segments: readonly SpectrumSegment[]
): number {
  const nonZero = segments.filter((s) => s.percentage > 0)
  if (nonZero.length === 0) return 0.5
  if (nonZero.length === 1) return 0.5

  const total = nonZero.reduce((sum, s) => sum + s.percentage, 0)
  if (total <= 0) return 0.5

  let entropy = 0
  for (const segment of nonZero) {
    const p = segment.percentage / total
    if (p > 0) entropy -= p * Math.log(p)
  }

  const maxEntropy = Math.log(nonZero.length)
  const normalized = maxEntropy === 0 ? 0 : entropy / maxEntropy
  return 0.5 + 0.5 * normalized
}

/**
 * Compute the trending score for a single story.
 * Returns a non-negative finite number. Higher = more "trending".
 */
export function computeTrendingScore(input: TrendingInputs): number {
  const { impactScore, articles24h, spectrumSegments, publishedAt } = input
  const now = input.now ?? new Date()
  const gravity = input.gravity ?? DEFAULT_GRAVITY

  if (impactScore <= 0) return 0

  const velocityKicker = 1 + Math.log10(Math.max(articles24h, 1))
  const diversity = shannonDiversityFactor(spectrumSegments)

  const publishedMs = new Date(publishedAt).getTime()
  const elapsedMs = Math.max(0, now.getTime() - publishedMs)
  const hoursSince = elapsedMs / MS_PER_HOUR
  const timeDecay = 1 / Math.pow(hoursSince + TIME_OFFSET_HOURS, gravity)

  return impactScore * velocityKicker * diversity * timeDecay
}

/**
 * Shape required to rank a batch of stories. The sort is pure — no mutation.
 */
interface RankableStory {
  readonly impactScore: number
  readonly articles24h: number
  readonly spectrumSegments: readonly SpectrumSegment[]
  readonly publishedAt: string
}

/**
 * Return a new array of stories ordered by descending trending score.
 */
export function rankByTrendingScore<T extends RankableStory>(
  stories: readonly T[],
  now: Date = new Date()
): T[] {
  return stories
    .map((story) => ({
      story,
      score: computeTrendingScore({
        impactScore: story.impactScore,
        articles24h: story.articles24h,
        spectrumSegments: story.spectrumSegments,
        publishedAt: story.publishedAt,
        now,
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.story)
}
