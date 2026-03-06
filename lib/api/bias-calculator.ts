/**
 * lib/api/bias-calculator.ts — Pure function to compute user bias distribution.
 *
 * Takes reading history joined with story spectrum data and computes:
 *   - User's bias distribution (percentage per BiasCategory)
 *   - Overall population distribution for comparison
 *   - Blindspot categories (underrepresented in user's reading)
 */

import type { BiasCategory } from '@/lib/types'

const ALL_BIASES: readonly BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]

export interface BiasDistribution {
  readonly bias: BiasCategory
  readonly percentage: number
}

export interface BiasProfile {
  readonly userDistribution: readonly BiasDistribution[]
  readonly overallDistribution: readonly BiasDistribution[]
  readonly blindspots: readonly BiasCategory[]
  readonly totalStoriesRead: number
  readonly dominantBias: BiasCategory | null
}

export interface StoryWithSpectrum {
  readonly spectrum_segments: readonly { bias: string; percentage: number }[] | null
}

/**
 * Computes a bias distribution from an array of stories with spectrum data.
 * Each story's spectrum segments are weighted equally (normalized per-story).
 */
function computeDistribution(stories: readonly StoryWithSpectrum[]): readonly BiasDistribution[] {
  if (stories.length === 0) {
    return ALL_BIASES.map((bias) => ({ bias, percentage: 0 }))
  }

  const totals: Record<string, number> = {}
  for (const bias of ALL_BIASES) {
    totals[bias] = 0
  }

  for (const story of stories) {
    const segments = story.spectrum_segments
    if (!Array.isArray(segments)) continue

    for (const segment of segments) {
      if (segment.bias in totals) {
        totals[segment.bias] += segment.percentage
      }
    }
  }

  const grandTotal = Object.values(totals).reduce((sum, v) => sum + v, 0)
  if (grandTotal === 0) {
    return ALL_BIASES.map((bias) => ({ bias, percentage: 0 }))
  }

  return ALL_BIASES.map((bias) => ({
    bias,
    percentage: Math.round((totals[bias] / grandTotal) * 100),
  }))
}

/**
 * Identifies bias categories where the user reads significantly less than
 * the overall distribution (threshold: 5% absolute difference and user < half of overall).
 */
function identifyBlindspots(
  userDist: readonly BiasDistribution[],
  overallDist: readonly BiasDistribution[]
): readonly BiasCategory[] {
  const blindspots: BiasCategory[] = []

  for (const bias of ALL_BIASES) {
    const userPct = userDist.find((d) => d.bias === bias)?.percentage ?? 0
    const overallPct = overallDist.find((d) => d.bias === bias)?.percentage ?? 0

    if (overallPct >= 5 && userPct < overallPct / 2) {
      blindspots.push(bias)
    }
  }

  return blindspots
}

/**
 * Computes the full bias profile for a user.
 *
 * @param userStories - Stories the user has read (with spectrum data)
 * @param allStories - All available stories (for overall distribution)
 */
export function computeBiasProfile(
  userStories: readonly StoryWithSpectrum[],
  allStories: readonly StoryWithSpectrum[]
): BiasProfile {
  const userDistribution = computeDistribution(userStories)
  const overallDistribution = computeDistribution(allStories)
  const blindspots = identifyBlindspots(userDistribution, overallDistribution)

  const dominant = [...userDistribution].sort((a, b) => b.percentage - a.percentage)[0]

  return {
    userDistribution,
    overallDistribution,
    blindspots,
    totalStoriesRead: userStories.length,
    dominantBias: dominant && dominant.percentage > 0 ? dominant.bias : null,
  }
}
