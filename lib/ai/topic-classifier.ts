/**
 * lib/ai/topic-classifier.ts — Topic classification for article clusters.
 *
 * Provides deterministic keyword-based topic fallback classification.
 */

import type { Topic } from '@/lib/types'

const TOPIC_KEYWORDS: ReadonlyArray<readonly [Topic, readonly string[]]> = [
  ['technology', ['ai', 'artificial intelligence', 'technology', 'tech', 'software', 'chip', 'cyber', 'startup']],
  ['business', ['market', 'stocks', 'stock', 'economy', 'economic', 'trade', 'inflation', 'bank', 'earnings', 'tariff']],
  ['science', ['research', 'scientists', 'science', 'space', 'nasa', 'physics', 'laboratory']],
  ['health', ['health', 'hospital', 'medical', 'medicine', 'vaccine', 'disease', 'public health']],
  ['culture', ['music', 'film', 'movie', 'television', 'tv', 'festival', 'book', 'celebrity']],
  ['sports', ['sport', 'sports', 'tournament', 'season', 'match', 'playoff', 'nba', 'nfl', 'mlb', 'soccer', 'olympic']],
  ['environment', ['climate', 'wildfire', 'storm', 'hurricane', 'flood', 'emissions', 'environment', 'earthquake']],
  ['world', ['war', 'summit', 'diplomat', 'diplomatic', 'foreign', 'global', 'international', 'united nations']],
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesKeyword(normalizedTitles: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return normalizedTitles.includes(keyword)
  }

  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(normalizedTitles)
}

export function fallbackTopic(articleTitles: readonly string[]): Topic {
  const normalizedTitles = articleTitles.join(' ').toLowerCase()

  for (const [topic, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some((keyword) => matchesKeyword(normalizedTitles, keyword))) {
      return topic
    }
  }

  return 'politics'
}
