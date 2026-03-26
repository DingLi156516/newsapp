/**
 * lib/ai/region-classifier.ts — Region classification for article clusters.
 *
 * Uses Gemini to classify a group of article titles into one of the
 * predefined geographic region categories.
 */

import type { Region } from '@/lib/types'
import { generateText } from '@/lib/ai/gemini-client'

const VALID_REGIONS: readonly Region[] = [
  'us', 'international', 'uk', 'canada', 'europe',
]

export async function classifyRegion(
  articleTitles: readonly string[]
): Promise<Region> {
  if (articleTitles.length === 0) {
    return 'us'
  }

  const titlesBlock = articleTitles.join('\n')

  const prompt = `Classify these news article titles into exactly ONE geographic region.

Article titles:
${titlesBlock}

Valid regions: ${VALID_REGIONS.join(', ')}

Return ONLY the region name, nothing else.`

  const response = await generateText(prompt)
  const region = response.text.trim().toLowerCase() as Region

  if (VALID_REGIONS.includes(region)) {
    return region
  }

  return 'us'
}
