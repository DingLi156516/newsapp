/**
 * lib/ai/topic-classifier.ts — Topic classification for article clusters.
 *
 * Uses Gemini to classify a group of article titles into one of the
 * predefined topic categories (politics, world, technology, etc.).
 */

import type { Topic } from '@/lib/types'
import { generateText } from '@/lib/ai/gemini-client'

const VALID_TOPICS: readonly Topic[] = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
]

export async function classifyTopic(
  articleTitles: readonly string[]
): Promise<Topic> {
  if (articleTitles.length === 0) {
    return 'politics'
  }

  const titlesBlock = articleTitles.join('\n')

  const prompt = `Classify these news article titles into exactly ONE topic category.

Article titles:
${titlesBlock}

Valid categories: ${VALID_TOPICS.join(', ')}

Return ONLY the category name, nothing else.`

  const response = await generateText(prompt)
  const topic = response.text.trim().toLowerCase() as Topic

  if (VALID_TOPICS.includes(topic)) {
    return topic
  }

  return 'politics'
}
