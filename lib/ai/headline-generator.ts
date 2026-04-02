/**
 * lib/ai/headline-generator.ts — Neutral headline generation for stories.
 *
 * Uses Gemini to generate a neutral, factual headline from the titles
 * of articles in a cluster. Avoids loaded language or bias framing.
 */

import { CHEAP_GENERATION_MODEL, generateText } from '@/lib/ai/gemini-client'

export interface HeadlineGenerationResult {
  readonly headline: string
  readonly usedCheapModel: boolean
  readonly usedFallback: boolean
}

function fallbackHeadline(articleTitles: readonly string[]): string {
  return articleTitles[0]?.trim().replace(/^["']|["']$/g, '') || 'Developing story'
}

export async function generateNeutralHeadline(
  articleTitles: readonly string[]
): Promise<HeadlineGenerationResult> {
  if (articleTitles.length === 0) {
    throw new Error('Cannot generate headline from empty article list')
  }

  const titlesBlock = articleTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')

  const prompt = `You are a neutral news editor. Given these article titles about the same news event, write a single neutral, factual headline that captures the core story without bias or loaded language. Return ONLY the headline, nothing else.

Article titles:
${titlesBlock}

Neutral headline:`

  try {
    const response = await generateText(prompt, { model: CHEAP_GENERATION_MODEL })
    const headline = response.text.trim().replace(/^["']|["']$/g, '')

    if (!headline) {
      return {
        headline: fallbackHeadline(articleTitles),
        usedCheapModel: true,
        usedFallback: true,
      }
    }

    return {
      headline,
      usedCheapModel: true,
      usedFallback: false,
    }
  } catch {
    return {
      headline: fallbackHeadline(articleTitles),
      usedCheapModel: true,
      usedFallback: true,
    }
  }
}
