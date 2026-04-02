/**
 * lib/ai/headline-generator.ts — Neutral headline generation for stories.
 *
 * Uses Gemini to generate a neutral, factual headline from the titles
 * of articles in a cluster. Avoids loaded language or bias framing.
 */

import { generateText } from '@/lib/ai/gemini-client'

function fallbackHeadline(articleTitles: readonly string[]): string {
  return articleTitles[0].trim().replace(/^["']|["']$/g, '')
}

export async function generateNeutralHeadline(
  articleTitles: readonly string[]
): Promise<string> {
  if (articleTitles.length === 0) {
    throw new Error('Cannot generate headline from empty article list')
  }

  const titlesBlock = articleTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')

  const prompt = `You are a neutral news editor. Given these article titles about the same news event, write a single neutral, factual headline that captures the core story without bias or loaded language. Return ONLY the headline, nothing else.

Article titles:
${titlesBlock}

Neutral headline:`

  try {
    const response = await generateText(prompt, { task: 'headline' })
    const normalized = response.text.trim().replace(/^["']|["']$/g, '')
    return normalized || fallbackHeadline(articleTitles)
  } catch {
    return fallbackHeadline(articleTitles)
  }
}
