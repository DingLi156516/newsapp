/**
 * lib/ai/story-metrics.ts — Computed story metrics (zero AI cost).
 *
 * Derives velocity, impact, source diversity, and controversy score
 * from existing article/source data during assembly.
 */

import type { StoryVelocity, NarrativePhase, AISummary } from '@/lib/types'

interface ArticleTimestamp {
  readonly published_at: string
}

/**
 * Compute story velocity from article timestamps relative to a reference time.
 * Returns article counts over 24h/48h/7d windows and a narrative phase.
 */
export function computeStoryVelocity(
  articles: readonly ArticleTimestamp[],
  storyCreatedAt: string,
  now: Date = new Date()
): StoryVelocity {
  const nowMs = now.getTime()
  const ms24h = 24 * 60 * 60 * 1000
  const ms48h = 48 * 60 * 60 * 1000
  const ms7d = 7 * 24 * 60 * 60 * 1000

  let articles24h = 0
  let articles48h = 0
  let articles7d = 0

  for (const article of articles) {
    const age = nowMs - new Date(article.published_at).getTime()
    if (age <= ms24h) articles24h += 1
    if (age <= ms48h) articles48h += 1
    if (age <= ms7d) articles7d += 1
  }

  const storyAgeMs = nowMs - new Date(storyCreatedAt).getTime()
  const phase = derivePhase(articles24h, articles7d, storyAgeMs)

  return { articles_24h: articles24h, articles_48h: articles48h, articles_7d: articles7d, phase }
}

function derivePhase(
  articles24h: number,
  articles7d: number,
  storyAgeMs: number
): NarrativePhase {
  const ms24h = 24 * 60 * 60 * 1000
  const ms7d = 7 * 24 * 60 * 60 * 1000

  if (articles24h >= 3 && storyAgeMs < ms24h) return 'breaking'
  if (articles24h >= 1 && storyAgeMs < ms7d) return 'developing'
  if (articles24h === 0 && articles7d >= 2) return 'analysis'
  return 'aftermath'
}

/**
 * Count unique ownership types across article sources.
 */
export function computeSourceDiversity(
  ownerships: readonly string[]
): number {
  return new Set(ownerships).size
}

/**
 * Compute impact score (0-100) from source count, velocity, duration, and diversity.
 */
export function computeImpactScore(
  sourceCount: number,
  velocity24h: number,
  coverageDurationHours: number,
  sourceDiversity: number
): number {
  // Normalize each component to 0-1 range with reasonable caps
  const normalizedSources = Math.min(sourceCount / 20, 1)
  const normalizedVelocity = Math.min(velocity24h / 10, 1)
  const normalizedDuration = Math.min(coverageDurationHours / 168, 1) // 7 days cap
  const normalizedDiversity = Math.min(sourceDiversity / 6, 1)

  const raw =
    normalizedSources * 0.3 +
    normalizedVelocity * 0.3 +
    normalizedDuration * 0.2 +
    normalizedDiversity * 0.2

  return Math.round(raw * 100)
}

/**
 * Compute controversy score (0.0-1.0) from AI summary by measuring
 * textual divergence between leftFraming and rightFraming.
 */
export function computeControversyScore(aiSummary: AISummary): number {
  const leftWords = extractUniqueWords(aiSummary.leftFraming)
  const rightWords = extractUniqueWords(aiSummary.rightFraming)

  if (leftWords.size === 0 && rightWords.size === 0) return 0

  let leftOnly = 0
  for (const word of leftWords) {
    if (!rightWords.has(word)) leftOnly += 1
  }

  let rightOnly = 0
  for (const word of rightWords) {
    if (!leftWords.has(word)) rightOnly += 1
  }

  const totalUnique = new Set([...leftWords, ...rightWords]).size
  if (totalUnique === 0) return 0

  const divergence = (leftOnly + rightOnly) / (totalUnique * 2)
  return Math.round(Math.min(divergence * 2, 1) * 100) / 100
}

function extractUniqueWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )
}

/**
 * Compute coverage duration in hours from article timestamps.
 */
export function computeCoverageDurationHours(
  articles: readonly ArticleTimestamp[]
): number {
  if (articles.length < 2) return 0

  let earliest = Infinity
  let latest = -Infinity

  for (const article of articles) {
    const ts = new Date(article.published_at).getTime()
    if (ts < earliest) earliest = ts
    if (ts > latest) latest = ts
  }

  return (latest - earliest) / (60 * 60 * 1000)
}
