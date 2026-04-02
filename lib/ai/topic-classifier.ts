/**
 * lib/ai/topic-classifier.ts — Topic classification for article clusters.
 *
 * Uses Gemini to classify a group of article titles into one of the
 * predefined topic categories (politics, world, technology, etc.).
 */

import type { Topic } from '@/lib/types'
import { CHEAP_GENERATION_MODEL, generateText } from '@/lib/ai/gemini-client'

const VALID_TOPICS: readonly Topic[] = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
]

export interface TopicClassificationResult {
  readonly topic: Topic
  readonly usedCheapModel: boolean
  readonly usedFallback: boolean
}

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

function fallbackTopic(articleTitles: readonly string[]): Topic {
  const normalizedTitles = articleTitles.join(' ').toLowerCase()

  for (const [topic, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some((keyword) => matchesKeyword(normalizedTitles, keyword))) {
      return topic
    }
  }

  return 'politics'
}

export async function classifyTopic(
  articleTitles: readonly string[]
): Promise<TopicClassificationResult> {
  if (articleTitles.length === 0) {
    return { topic: 'politics', usedCheapModel: false, usedFallback: true }
  }

  const titlesBlock = articleTitles.join('\n')

  const prompt = `Classify these news article titles into exactly ONE topic category.

Article titles:
${titlesBlock}

Valid categories: ${VALID_TOPICS.join(', ')}

Return ONLY the category name, nothing else.`

  try {
    const response = await generateText(prompt, { model: CHEAP_GENERATION_MODEL })
    const topic = response.text.trim().toLowerCase() as Topic

    if (VALID_TOPICS.includes(topic)) {
      return { topic, usedCheapModel: true, usedFallback: false }
    }
  } catch {
    // fall through to deterministic fallback
  }

  return {
    topic: fallbackTopic(articleTitles),
    usedCheapModel: true,
    usedFallback: true,
  }
}
