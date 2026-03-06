/**
 * lib/ai/summary-generator.ts — Cross-spectrum AI summary generation.
 *
 * Generates structured summaries with commonGround, leftFraming, and
 * rightFraming sections by analyzing articles from different bias categories.
 */

import type { AISummary } from '@/lib/types'
import { generateText } from '@/lib/ai/gemini-client'

interface ArticleWithBias {
  readonly title: string
  readonly description: string | null
  readonly bias: string
}

export async function generateAISummary(
  articles: readonly ArticleWithBias[]
): Promise<AISummary> {
  if (articles.length === 0) {
    return {
      commonGround: 'Insufficient coverage for analysis.',
      leftFraming: 'No left-leaning perspectives available.',
      rightFraming: 'No right-leaning perspectives available.',
    }
  }

  const articlesBlock = articles
    .map((a) => `[${a.bias.toUpperCase()}] ${a.title}${a.description ? ` — ${a.description}` : ''}`)
    .join('\n')

  const prompt = `You are a media analyst. Analyze these news articles about the same story from different political perspectives.

Articles:
${articlesBlock}

Generate a structured summary in exactly this JSON format (no markdown, no code blocks):
{
  "commonGround": "bullet points of facts agreed upon across the spectrum, each starting with •",
  "leftFraming": "bullet points of how left-leaning outlets frame this story, each starting with •",
  "rightFraming": "bullet points of how right-leaning outlets frame this story, each starting with •"
}

Each section should have 2-4 bullet points separated by newlines. Return ONLY valid JSON.`

  try {
    const response = await generateText(prompt, { jsonMode: true })

    if (!response.text.trim()) {
      console.error('[summary-generator] Empty response from Gemini — retrying with fewer articles')
      return retryWithFewerArticles(articles)
    }

    const parsed = JSON.parse(response.text.trim()) as AISummary
    return {
      commonGround: parsed.commonGround ?? 'Analysis pending.',
      leftFraming: parsed.leftFraming ?? 'Analysis pending.',
      rightFraming: parsed.rightFraming ?? 'Analysis pending.',
    }
  } catch (err) {
    console.error('[summary-generator] Failed:', err instanceof Error ? err.message : String(err))
    return retryWithFewerArticles(articles)
  }
}

function sampleArticles(
  articles: readonly ArticleWithBias[],
  maxPerBias: number
): readonly ArticleWithBias[] {
  const byBias = new Map<string, ArticleWithBias[]>()
  for (const a of articles) {
    const group = byBias.get(a.bias) ?? []
    group.push(a)
    byBias.set(a.bias, group)
  }

  const sampled: ArticleWithBias[] = []
  for (const group of byBias.values()) {
    sampled.push(...group.slice(0, maxPerBias))
  }
  return sampled
}

async function retryWithFewerArticles(
  articles: readonly ArticleWithBias[]
): Promise<AISummary> {
  const sampled = sampleArticles(articles, 2)

  const articlesBlock = sampled
    .map((a) => `[${a.bias.toUpperCase()}] ${a.title}`)
    .join('\n')

  const prompt = `Analyze these news headlines from different political perspectives and generate a JSON summary.

Headlines:
${articlesBlock}

Return JSON with this exact structure:
{
  "commonGround": "facts agreed upon across the spectrum, each point starting with •",
  "leftFraming": "how left-leaning outlets frame this, each point starting with •",
  "rightFraming": "how right-leaning outlets frame this, each point starting with •"
}

Each section should have 2-3 bullet points. Return ONLY valid JSON.`

  try {
    const response = await generateText(prompt, { jsonMode: true })

    if (!response.text.trim()) {
      console.error('[summary-generator] Retry also returned empty response')
      return fallbackSummary()
    }

    const parsed = JSON.parse(response.text.trim()) as AISummary
    return {
      commonGround: parsed.commonGround ?? 'Analysis pending.',
      leftFraming: parsed.leftFraming ?? 'Analysis pending.',
      rightFraming: parsed.rightFraming ?? 'Analysis pending.',
    }
  } catch (retryErr) {
    console.error('[summary-generator] Retry failed:', retryErr instanceof Error ? retryErr.message : String(retryErr))
    return fallbackSummary()
  }
}

function fallbackSummary(): AISummary {
  return {
    commonGround: 'AI summary generation failed. Manual review needed.',
    leftFraming: 'Analysis unavailable.',
    rightFraming: 'Analysis unavailable.',
  }
}
