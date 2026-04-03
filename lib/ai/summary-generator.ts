/**
 * lib/ai/summary-generator.ts — Cross-spectrum AI summary generation.
 *
 * Generates structured summaries with commonGround, leftFraming, and
 * rightFraming sections by analyzing articles from different bias categories.
 */

import type { AISummary, StorySentiment, KeyQuote, KeyClaim, SentimentLabel } from '@/lib/types'
import { generateText, SUMMARY_GENERATION_MODEL } from '@/lib/ai/gemini-client'

interface ArticleWithBias {
  readonly title: string
  readonly description: string | null
  readonly bias: string
}

export interface ExpandedSummaryResult {
  readonly aiSummary: AISummary
  readonly sentiment: StorySentiment | null
  readonly keyQuotes: KeyQuote[] | null
  readonly keyClaims: KeyClaim[] | null
}

const VALID_SENTIMENTS = new Set<string>([
  'angry', 'fearful', 'hopeful', 'neutral', 'critical', 'celebratory',
])

const FALLBACK_COMMON_GROUND = 'AI summary generation failed. Manual review needed.'
const FALLBACK_LEFT = 'Analysis unavailable.'
const FALLBACK_RIGHT = 'Analysis unavailable.'

export async function generateAISummary(
  articles: readonly ArticleWithBias[]
): Promise<ExpandedSummaryResult> {
  if (articles.length === 0) {
    return {
      aiSummary: {
        commonGround: 'Insufficient coverage for analysis.',
        leftFraming: 'No left-leaning perspectives available.',
        rightFraming: 'No right-leaning perspectives available.',
      },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    }
  }

  const articlesBlock = articles
    .map((article) => `[${article.bias.toUpperCase()}] ${article.title}${article.description ? ` — ${article.description}` : ''}`)
    .join('\n')

  const prompt = `You are a media analyst. Analyze these news articles about the same story from different political perspectives.

Articles:
${articlesBlock}

Generate a structured summary in exactly this JSON format (no markdown, no code blocks):
{
  "commonGround": "bullet points of facts agreed upon across the spectrum, each starting with •",
  "leftFraming": "bullet points of how left-leaning outlets frame this story, each starting with •",
  "rightFraming": "bullet points of how right-leaning outlets frame this story, each starting with •",
  "leftSentiment": "one of: angry, fearful, hopeful, neutral, critical, celebratory",
  "rightSentiment": "one of: angry, fearful, hopeful, neutral, critical, celebratory",
  "keyQuotes": [
    { "text": "exact notable quote from an article", "sourceName": "outlet name", "sourceBias": "bias category" }
  ],
  "keyClaims": [
    { "claim": "a factual claim made in coverage", "side": "left or right or both", "disputed": true, "counterClaim": "opposing claim if disputed" }
  ]
}

Each summary section should have 2-4 bullet points separated by newlines.
Include 1-3 key quotes and 1-3 key claims. Return ONLY valid JSON.`

  try {
    const response = await generateText(prompt, {
      jsonMode: true,
      model: SUMMARY_GENERATION_MODEL,
    })

    if (!response.text.trim()) {
      console.error('[summary-generator] Empty response from Gemini — retrying with fewer articles')
      return retryWithFewerArticles(articles)
    }

    return parseExpandedSummary(response.text.trim())
  } catch (err) {
    console.error('[summary-generator] Failed:', err instanceof Error ? err.message : String(err))
    return retryWithFewerArticles(articles)
  }
}

export function parseExpandedSummary(text: string): ExpandedSummaryResult {
  const parsed = JSON.parse(text) as Record<string, unknown>

  const aiSummary: AISummary = {
    commonGround: String(parsed.commonGround ?? 'Analysis pending.'),
    leftFraming: String(parsed.leftFraming ?? 'Analysis pending.'),
    rightFraming: String(parsed.rightFraming ?? 'Analysis pending.'),
  }

  const sentiment = parseResponseSentiment(parsed)
  const keyQuotes = parseResponseQuotes(parsed)
  const keyClaims = parseResponseClaims(parsed)

  return { aiSummary, sentiment, keyQuotes, keyClaims }
}

function parseResponseSentiment(parsed: Record<string, unknown>): StorySentiment | null {
  const left = String(parsed.leftSentiment ?? '')
  const right = String(parsed.rightSentiment ?? '')
  if (!VALID_SENTIMENTS.has(left) || !VALID_SENTIMENTS.has(right)) return null
  return { left: left as SentimentLabel, right: right as SentimentLabel }
}

function parseResponseQuotes(parsed: Record<string, unknown>): KeyQuote[] | null {
  if (!Array.isArray(parsed.keyQuotes)) return null
  const quotes = parsed.keyQuotes
    .filter(
      (q): q is { text: string; sourceName: string; sourceBias: string } =>
        typeof q === 'object' &&
        q !== null &&
        typeof q.text === 'string' &&
        typeof q.sourceName === 'string' &&
        typeof q.sourceBias === 'string'
    )
    .map((q) => ({ text: q.text, sourceName: q.sourceName, sourceBias: q.sourceBias }))
  return quotes.length > 0 ? quotes : null
}

function parseResponseClaims(parsed: Record<string, unknown>): KeyClaim[] | null {
  if (!Array.isArray(parsed.keyClaims)) return null
  const validSides = new Set(['left', 'right', 'both'])
  const claims = parsed.keyClaims
    .filter(
      (c): c is { claim: string; side: string; disputed: boolean; counterClaim?: string } =>
        typeof c === 'object' &&
        c !== null &&
        typeof c.claim === 'string' &&
        typeof c.side === 'string' &&
        validSides.has(c.side) &&
        typeof c.disputed === 'boolean'
    )
    .map((c) => ({
      claim: c.claim,
      side: c.side as KeyClaim['side'],
      disputed: c.disputed,
      ...(typeof c.counterClaim === 'string' && c.counterClaim ? { counterClaim: c.counterClaim } : {}),
    }))
  return claims.length > 0 ? claims : null
}

export function isFallbackSummary(summary: AISummary | ExpandedSummaryResult): boolean {
  const s = 'aiSummary' in summary ? summary.aiSummary : summary
  return s.commonGround === FALLBACK_COMMON_GROUND
    && s.leftFraming === FALLBACK_LEFT
    && s.rightFraming === FALLBACK_RIGHT
}

function sampleArticles(
  articles: readonly ArticleWithBias[],
  maxPerBias: number
): readonly ArticleWithBias[] {
  const byBias = new Map<string, ArticleWithBias[]>()
  for (const article of articles) {
    const group = byBias.get(article.bias) ?? []
    group.push(article)
    byBias.set(article.bias, group)
  }

  const sampled: ArticleWithBias[] = []
  for (const group of byBias.values()) {
    sampled.push(...group.slice(0, maxPerBias))
  }
  return sampled
}

async function retryWithFewerArticles(
  articles: readonly ArticleWithBias[]
): Promise<ExpandedSummaryResult> {
  const sampled = sampleArticles(articles, 2)

  const articlesBlock = sampled
    .map((article) => `[${article.bias.toUpperCase()}] ${article.title}`)
    .join('\n')

  const prompt = `Analyze these news headlines from different political perspectives and generate a JSON summary.

Headlines:
${articlesBlock}

Return JSON with this exact structure:
{
  "commonGround": "facts agreed upon across the spectrum, each point starting with •",
  "leftFraming": "how left-leaning outlets frame this, each point starting with •",
  "rightFraming": "how right-leaning outlets frame this, each point starting with •",
  "leftSentiment": "one of: angry, fearful, hopeful, neutral, critical, celebratory",
  "rightSentiment": "one of: angry, fearful, hopeful, neutral, critical, celebratory"
}

Each section should have 2-3 bullet points. Return ONLY valid JSON.`

  try {
    const response = await generateText(prompt, {
      jsonMode: true,
      model: SUMMARY_GENERATION_MODEL,
    })

    if (!response.text.trim()) {
      console.error('[summary-generator] Retry also returned empty response')
      return fallbackSummary()
    }

    return parseExpandedSummary(response.text.trim())
  } catch (retryErr) {
    console.error('[summary-generator] Retry failed:', retryErr instanceof Error ? retryErr.message : String(retryErr))
    return fallbackSummary()
  }
}

function fallbackSummary(): ExpandedSummaryResult {
  return {
    aiSummary: {
      commonGround: FALLBACK_COMMON_GROUND,
      leftFraming: FALLBACK_LEFT,
      rightFraming: FALLBACK_RIGHT,
    },
    sentiment: null,
    keyQuotes: null,
    keyClaims: null,
  }
}
