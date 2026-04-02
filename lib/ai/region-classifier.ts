/**
 * lib/ai/region-classifier.ts — Region classification for article clusters.
 *
 * Uses Gemini to classify a group of article titles into one of the
 * predefined geographic region categories.
 */

import type { Region } from '@/lib/types'
import { CHEAP_GENERATION_MODEL, generateText } from '@/lib/ai/gemini-client'

const VALID_REGIONS: readonly Region[] = [
  'us', 'international', 'uk', 'canada', 'europe',
]

export interface RegionClassificationResult {
  readonly region: Region
  readonly usedCheapModel: boolean
  readonly usedFallback: boolean
}

function fallbackRegion(articleTitles: readonly string[]): Region {
  const lowered = articleTitles.join(' ').toLowerCase()
  if (/(london|britain|uk\b|england|scotland)/.test(lowered)) return 'uk'
  if (/(toronto|ottawa|canada|canadian)/.test(lowered)) return 'canada'
  if (/(paris|berlin|brussels|europe|eu\b)/.test(lowered)) return 'europe'
  if (/(washington|white house|senate|u\.s\.|usa|american)/.test(lowered)) return 'us'
  return 'international'
}

export async function classifyRegion(
  articleTitles: readonly string[]
): Promise<RegionClassificationResult | Region> {
  if (articleTitles.length === 0) {
    return { region: 'us', usedCheapModel: false, usedFallback: true }
  }

  const titlesBlock = articleTitles.join('\n')

  const prompt = `Classify these news article titles into exactly ONE geographic region.

Article titles:
${titlesBlock}

Valid regions: ${VALID_REGIONS.join(', ')}

Return ONLY the region name, nothing else.`

  try {
    const response = await generateText(prompt, { model: CHEAP_GENERATION_MODEL })
    const region = response.text.trim().toLowerCase() as Region

    if (VALID_REGIONS.includes(region)) {
      return { region, usedCheapModel: true, usedFallback: false }
    }
  } catch {
    // fall through to deterministic fallback
  }

  return {
    region: fallbackRegion(articleTitles),
    usedCheapModel: true,
    usedFallback: true,
  }
}
