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

const REGION_KEYWORDS: ReadonlyArray<readonly [Region, readonly string[]]> = [
  ['uk', [' uk ', 'britain', 'british', 'england', 'scotland', 'wales', 'london', 'parliament', 'westminster']],
  ['canada', ['canada', 'canadian', 'ottawa', 'trudeau', 'toronto', 'vancouver']],
  ['europe', ['europe', 'european', 'eu ', 'brussels', 'france', 'germany', 'italy', 'spain']],
  ['international', ['g20', 'g7', 'nato', 'united nations', 'u.n.', 'global', 'world leaders', 'summit']],
]

function fallbackRegion(articleTitles: readonly string[]): Region {
  const normalizedTitles = ` ${articleTitles.join(' ').toLowerCase()} `

  for (const [region, keywords] of REGION_KEYWORDS) {
    if (keywords.some((keyword) => normalizedTitles.includes(keyword))) {
      return region
    }
  }

  return 'us'
}

export async function classifyRegion(
  articleTitles: readonly string[]
): Promise<RegionClassificationResult> {
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
