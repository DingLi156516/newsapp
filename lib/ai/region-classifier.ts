/**
 * lib/ai/region-classifier.ts — Region classification for article clusters.
 *
 * Provides deterministic keyword-based region fallback classification.
 */

import type { Region } from '@/lib/types'

const REGION_KEYWORDS: ReadonlyArray<readonly [Region, readonly string[]]> = [
  ['uk', [' uk ', 'britain', 'british', 'england', 'scotland', 'wales', 'london', 'parliament', 'westminster']],
  ['canada', ['canada', 'canadian', 'ottawa', 'trudeau', 'toronto', 'vancouver']],
  ['europe', ['europe', 'european', 'eu ', 'brussels', 'france', 'germany', 'italy', 'spain']],
  ['international', ['g20', 'g7', 'nato', 'united nations', 'u.n.', 'global', 'world leaders', 'summit']],
]

export function fallbackRegion(articleTitles: readonly string[]): Region {
  const normalizedTitles = ` ${articleTitles.join(' ').toLowerCase()} `

  for (const [region, keywords] of REGION_KEYWORDS) {
    if (keywords.some((keyword) => normalizedTitles.includes(keyword))) {
      return region
    }
  }

  return 'us'
}
