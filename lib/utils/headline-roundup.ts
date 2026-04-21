/**
 * lib/utils/headline-roundup.ts — Pick a representative headline per side (L/C/R).
 *
 * AllSides-style roundup: one headline for Left, Center, Right buckets.
 * Preference order within a side favors stronger-bias outlets.
 */

import type { HeadlineComparison, BiasCategory } from '@/lib/types'

const LEFT_PREFERENCE: readonly BiasCategory[] = ['far-left', 'left', 'lean-left']
const RIGHT_PREFERENCE: readonly BiasCategory[] = ['far-right', 'right', 'lean-right']

export interface HeadlineRoundupResult {
  readonly left?: HeadlineComparison
  readonly center?: HeadlineComparison
  readonly right?: HeadlineComparison
}

function pickByPreference(
  headlines: readonly HeadlineComparison[],
  preference: readonly BiasCategory[]
): HeadlineComparison | undefined {
  for (const bias of preference) {
    const match = headlines.find((h) => h.sourceBias === bias)
    if (match) return match
  }
  return undefined
}

export function selectHeadlineRoundup(
  headlines: readonly HeadlineComparison[]
): HeadlineRoundupResult {
  return {
    left: pickByPreference(headlines, LEFT_PREFERENCE),
    center: headlines.find((h) => h.sourceBias === 'center'),
    right: pickByPreference(headlines, RIGHT_PREFERENCE),
  }
}
