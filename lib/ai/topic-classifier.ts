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

function fallbackTopic(articleTitles: readonly string[]): Topic {
  const lowered = articleTitles.join(' ').toLowerCase()
  if (/(ai|chip|software|tech|apple|google|microsoft|openai)/.test(lowered)) return 'technology'
  if (/(market|economy|stock|trade|bank|inflation)/.test(lowered)) return 'business'
  if (/(health|hospital|disease|medical|vaccine)/.test(lowered)) return 'health'
  if (/(climate|wildfire|storm|weather|environment)/.test(lowered)) return 'environment'
  if (/(sport|nba|nfl|mlb|soccer|tennis)/.test(lowered)) return 'sports'
  if (/(election|senate|congress|president|policy|government)/.test(lowered)) return 'politics'
  return 'politics'
}

export async function classifyTopic(
  articleTitles: readonly string[]
): Promise<TopicClassificationResult | Topic> {
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
