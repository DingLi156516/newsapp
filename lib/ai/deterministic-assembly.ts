/**
 * lib/ai/deterministic-assembly.ts — No-cost story assembly helpers.
 *
 * Builds extractive story fields from article titles/descriptions and source
 * bias metadata. This intentionally avoids generated interpretation: the
 * output remains explainable, stable, and testable.
 */

import type {
  AISummary,
  KeyClaim,
  KeyQuote,
  StorySentiment,
  Topic,
  Region,
} from '@/lib/types'
import { fallbackTopic } from '@/lib/ai/topic-classifier'
import { fallbackRegion } from '@/lib/ai/region-classifier'

export interface DeterministicAssemblyArticle {
  readonly title: string
  readonly description: string | null
  readonly bias: string
}

export interface DeterministicAssemblyOptions {
  readonly isSingleSource: boolean
  // Optional classifier-supplied topic/region. When present, skip the
  // keyword fallback. Lets callers plug in the multi-signal thin-topic
  // classifier without this module reaching into the DB.
  readonly topic?: Topic
  readonly region?: Region
}

export interface DeterministicStoryAssembly {
  readonly headline: string
  readonly topic: Topic
  readonly region: Region
  readonly aiSummary: AISummary
  readonly sentiment: StorySentiment | null
  readonly keyQuotes: KeyQuote[] | null
  readonly keyClaims: KeyClaim[] | null
}

export const LEFT_BIASES = new Set(['far-left', 'left', 'lean-left'])
export const RIGHT_BIASES = new Set(['lean-right', 'right', 'far-right'])
const MIN_HEADLINE_WORDS = 4
const MAX_SUMMARY_BULLETS = 4
const MAX_CLAIMS = 4

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripOuterQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '')
}

function wordCount(value: string): number {
  return normalizeWhitespace(value).split(/\s+/).filter(Boolean).length
}

function dedupeKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/^[•\-\s]+/, '')
    .replace(/[.,;:!?]+$/g, '')
}

function uniqueValues(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of values) {
    const value = stripOuterQuotes(normalizeWhitespace(raw))
    if (!value) continue
    const key = dedupeKey(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }

  return result
}

function splitDescriptionSentences(description: string | null): string[] {
  if (!description) return []

  return description
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 0)
}

function extractClaimTexts(
  articles: readonly DeterministicAssemblyArticle[]
): string[] {
  return uniqueValues(
    articles.flatMap((article) => [
      article.title,
      ...splitDescriptionSentences(article.description),
    ])
  ).slice(0, MAX_CLAIMS)
}

function toBullets(values: readonly string[]): string {
  return values.map((value) => `• ${value}`).join('\n')
}

function sideForBias(bias: string): KeyClaim['side'] {
  if (LEFT_BIASES.has(bias)) return 'left'
  if (RIGHT_BIASES.has(bias)) return 'right'
  return 'both'
}

function mergeClaimSide(existing: KeyClaim['side'], next: KeyClaim['side']): KeyClaim['side'] {
  if (existing === next) return existing
  return 'both'
}

function buildKeyClaims(
  articles: readonly DeterministicAssemblyArticle[],
  isSingleSource: boolean,
  headline: string
): KeyClaim[] | null {
  const byClaim = new Map<string, KeyClaim>()

  const headlineKey = dedupeKey(headline)
  if (headlineKey) {
    byClaim.set(headlineKey, { claim: headline, side: 'both', disputed: false })
  }

  for (const article of articles) {
    for (const claim of uniqueValues([article.title, ...splitDescriptionSentences(article.description)])) {
      const key = dedupeKey(claim)
      const side = isSingleSource ? 'both' : sideForBias(article.bias)
      const existing = byClaim.get(key)
      if (existing) {
        byClaim.set(key, {
          ...existing,
          side: mergeClaimSide(existing.side, side),
        })
      } else {
        byClaim.set(key, { claim, side, disputed: false })
      }
    }
  }

  const claims = [...byClaim.values()].slice(0, MAX_CLAIMS)
  return claims.length > 0 ? claims : null
}

function framingForBiasGroup(
  articles: readonly DeterministicAssemblyArticle[],
  predicate: (bias: string) => boolean
): string {
  return toBullets(
    uniqueValues(
      articles
        .filter((article) => predicate(article.bias))
        .map((article) => article.title)
    ).slice(0, MAX_SUMMARY_BULLETS)
  )
}

export function selectRepresentativeHeadline(titles: readonly string[]): string {
  const candidates = uniqueValues(titles)
  if (candidates.length === 0) return 'Developing story'

  const viable = candidates.filter((title) => wordCount(title) >= MIN_HEADLINE_WORDS)
  const pool = viable.length > 0 ? viable : candidates

  return [...pool].sort((a, b) => {
    const wordDiff = wordCount(a) - wordCount(b)
    if (wordDiff !== 0) return wordDiff
    const charDiff = a.length - b.length
    if (charDiff !== 0) return charDiff
    return a.localeCompare(b)
  })[0]
}

export function buildDeterministicStoryAssembly(
  articles: readonly DeterministicAssemblyArticle[],
  options: DeterministicAssemblyOptions
): DeterministicStoryAssembly {
  const titles = articles.map((article) => article.title)
  const { isSingleSource } = options
  const headline = isSingleSource
    ? stripOuterQuotes(normalizeWhitespace(titles[0] ?? 'Developing story'))
    : selectRepresentativeHeadline(titles)

  const claimTexts = extractClaimTexts(articles)
  const commonGround = toBullets(
    uniqueValues([headline, ...claimTexts]).slice(0, MAX_SUMMARY_BULLETS)
  ) || '• Developing story'

  // For multi-source clusters, the AISummaryTabs UI renders both Left and
  // Right perspective tabs. Emit an explicit placeholder when a side has no
  // coverage so published stories never show a blank panel.
  const missingSidePlaceholder = '• No coverage from this side yet.'
  const leftFraming = isSingleSource
    ? ''
    : framingForBiasGroup(articles, (bias) => LEFT_BIASES.has(bias)) || missingSidePlaceholder
  const rightFraming = isSingleSource
    ? ''
    : framingForBiasGroup(articles, (bias) => RIGHT_BIASES.has(bias)) || missingSidePlaceholder

  const aiSummary: AISummary = {
    commonGround,
    leftFraming,
    rightFraming,
  }

  return {
    headline,
    topic: options.topic ?? fallbackTopic(titles),
    region: options.region ?? fallbackRegion(titles),
    aiSummary,
    sentiment: null,
    keyQuotes: null,
    keyClaims: buildKeyClaims(articles, isSingleSource, headline),
  }
}
