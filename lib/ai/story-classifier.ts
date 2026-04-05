import type { Topic, Region } from '@/lib/types'
import { z } from 'zod'
import { CHEAP_GENERATION_MODEL, generateText } from '@/lib/ai/gemini-client'
import { fallbackTopic } from '@/lib/ai/topic-classifier'
import { fallbackRegion } from '@/lib/ai/region-classifier'

const VALID_TOPICS: readonly Topic[] = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
]

const VALID_REGIONS: readonly Region[] = [
  'us', 'international', 'uk', 'canada', 'europe',
]

export interface StoryClassificationResult {
  readonly headline: string
  readonly topic: Topic
  readonly region: Region
  readonly usedCheapModel: boolean
  readonly headlineFallback: boolean
  readonly topicFallback: boolean
  readonly regionFallback: boolean
}

const responseSchema = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str)
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON' })
    return z.NEVER
  }
}).pipe(
  z.object({
    headline: z.string().optional(),
    topic: z.string().optional(),
    region: z.string().optional(),
  })
)

function buildPrompt(articleTitles: readonly string[]): string {
  const titlesBlock = articleTitles
    .map((title, i) => `${i + 1}. ${title}`)
    .join('\n')

  return `You are a neutral news editor. Given these article titles about the same news event, generate:
1. A neutral, factual headline (no bias or loaded language)
2. A topic category
3. A geographic region

Article titles:
${titlesBlock}

Valid topics: ${VALID_TOPICS.join(', ')}
Valid regions: ${VALID_REGIONS.join(', ')}

Return ONLY valid JSON (no markdown, no code blocks):
{"headline": "...", "topic": "...", "region": "..."}`
}

function parseResponse(text: string, articleTitles: readonly string[]): StoryClassificationResult {
  const parsed = responseSchema.safeParse(text.trim())
  if (!parsed.success) {
    throw new Error('Invalid JSON response')
  }

  const headlineRaw = String(parsed.data.headline ?? '').trim().replace(/^["']|["']$/g, '')
  const topicRaw = String(parsed.data.topic ?? '').trim().toLowerCase()
  const regionRaw = String(parsed.data.region ?? '').trim().toLowerCase()

  const isHeadlineValid = headlineRaw.length > 0
  const isTopicValid = VALID_TOPICS.includes(topicRaw as Topic)
  const isRegionValid = VALID_REGIONS.includes(regionRaw as Region)

  const topic: Topic = isTopicValid
    ? (topicRaw as Topic)
    : fallbackTopic(articleTitles)

  const region: Region = isRegionValid
    ? (regionRaw as Region)
    : fallbackRegion(articleTitles)

  const headline = isHeadlineValid
    ? headlineRaw
    : articleTitles[0].trim().replace(/^["']|["']$/g, '')

  return {
    headline,
    topic,
    region,
    usedCheapModel: true,
    headlineFallback: !isHeadlineValid,
    topicFallback: !isTopicValid,
    regionFallback: !isRegionValid,
  }
}

export async function classifyStory(
  articleTitles: readonly string[]
): Promise<StoryClassificationResult> {
  if (articleTitles.length === 0) {
    return {
      headline: 'Developing story',
      topic: 'politics',
      region: 'us',
      usedCheapModel: false,
      headlineFallback: true,
      topicFallback: true,
      regionFallback: true,
    }
  }

  try {
    const response = await generateText(buildPrompt(articleTitles), {
      jsonMode: true,
      model: CHEAP_GENERATION_MODEL,
    })

    return parseResponse(response.text, articleTitles)
  } catch {
    return {
      headline: articleTitles[0].trim().replace(/^["']|["']$/g, ''),
      topic: fallbackTopic(articleTitles),
      region: fallbackRegion(articleTitles),
      usedCheapModel: true,
      headlineFallback: true,
      topicFallback: true,
      regionFallback: true,
    }
  }
}
