/**
 * lib/api/trending-score.ts — Trending feed ranking (pure function).
 *
 * Composite score combining five story signals:
 *
 *   trending = impact_score
 *            × (1 + log10(max(articles_24h, 1)))      // velocity kicker
 *            × diversity_factor                        // 0.5 + 0.5 × normalized Shannon entropy
 *            × time_decay                              // 1 / (hours + 2)^gravity (HN-style)
 *            × (1 + log10(1 + unique_viewers_6h))      // engagement_factor (Phase 3)
 *
 * Gravity 1.5 gives a ~12h half-life, tunable via the `gravity` input.
 * `diversity_factor` rewards balanced coverage while keeping echo-chamber
 * stories rankable (never multiplies by zero). The engagement factor uses
 * `1 + log10(1 + N)` so:
 *   - 0 viewers → multiplier = 1 (no-op; new/unmeasured stories keep
 *     their editorial score and remain rankable cold).
 *   - 9 viewers → ~2× kicker.
 *   - 99 viewers → ~3× kicker.
 *   - 999 viewers → ~4× kicker.
 * Logarithmic so a viral spike doesn't pin the feed.
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
  /**
   * Distinct sessions that have viewed this story in the recent engagement
   * window (default 6h). Optional — when omitted (e.g., scoring a story
   * before any telemetry exists) the engagement factor is 1× so the
   * pre-Phase-3 ranking behavior is preserved.
   */
  readonly uniqueViewersRecent?: number
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
 * 1 + log10(1 + uniqueViewers). Multiplier is exactly 1 when there are no
 * observed viewers, so editorial-only ranking still works for unmeasured
 * stories. Saturates logarithmically so a viral spike doesn't dominate.
 */
export function engagementFactor(uniqueViewersRecent: number): number {
  if (!Number.isFinite(uniqueViewersRecent) || uniqueViewersRecent <= 0) return 1
  return 1 + Math.log10(1 + uniqueViewersRecent)
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

  const engagement = engagementFactor(input.uniqueViewersRecent ?? 0)

  return impactScore * velocityKicker * diversity * timeDecay * engagement
}

/**
 * Shape required to rank a batch of stories. The sort is pure — no mutation.
 */
interface RankableStory {
  readonly impactScore: number
  readonly articles24h: number
  readonly spectrumSegments: readonly SpectrumSegment[]
  readonly publishedAt: string
  readonly uniqueViewersRecent?: number
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
        uniqueViewersRecent: story.uniqueViewersRecent,
        now,
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.story)
}
