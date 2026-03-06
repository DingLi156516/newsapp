/**
 * lib/api/timeline-transformer.ts — Transforms articles into timeline events.
 *
 * Pure function: articles (sorted by published_at ASC) → StoryTimeline.
 * Emits three kinds of events:
 *   - source-added:   first time a source_id appears
 *   - spectrum-shift:  cumulative bias distribution changed ≥15pp in any category
 *   - milestone:       unique source count crosses threshold (5, 10, 25, 50, 100)
 */

import type { BiasCategory, SpectrumSegment, TimelineEvent, StoryTimeline } from '@/lib/types'
import type { ArticleWithSource } from '@/lib/api/query-helpers'

const BIAS_ORDER: readonly BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]

const MILESTONE_THRESHOLDS = [5, 10, 25, 50, 100] as const
const SHIFT_THRESHOLD = 15
const MAX_EVENTS = 20

function computeSpectrum(
  biasCounts: ReadonlyMap<BiasCategory, number>,
  total: number
): SpectrumSegment[] {
  if (total === 0) return []

  return BIAS_ORDER
    .map((bias) => ({
      bias,
      percentage: Math.round(((biasCounts.get(bias) ?? 0) / total) * 100),
    }))
    .filter((s) => s.percentage > 0)
}

function hasSignificantShift(
  prev: SpectrumSegment[],
  curr: SpectrumSegment[]
): boolean {
  if (prev.length === 0) return false

  const prevMap = new Map(prev.map((s) => [s.bias, s.percentage]))
  const currMap = new Map(curr.map((s) => [s.bias, s.percentage]))

  for (const bias of BIAS_ORDER) {
    const prevPct = prevMap.get(bias) ?? 0
    const currPct = currMap.get(bias) ?? 0
    if (Math.abs(currPct - prevPct) >= SHIFT_THRESHOLD) return true
  }

  return false
}

function checkMilestone(prevCount: number, currCount: number): number | null {
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (prevCount < threshold && currCount >= threshold) return threshold
  }
  return null
}

export function transformTimeline(
  storyId: string,
  articles: readonly ArticleWithSource[]
): StoryTimeline {
  if (articles.length === 0) {
    return { storyId, events: [], totalArticles: 0, timeSpanHours: 0 }
  }

  const events: TimelineEvent[] = []
  const seenSources = new Set<string>()
  const biasCounts = new Map<BiasCategory, number>()
  let totalSources = 0
  let prevSpectrum: SpectrumSegment[] = []
  let eventIndex = 0

  for (const article of articles) {
    const bias = article.source_bias as BiasCategory
    const isNewSource = !seenSources.has(article.source_id)

    if (isNewSource) {
      seenSources.add(article.source_id)
      biasCounts.set(bias, (biasCounts.get(bias) ?? 0) + 1)
      totalSources++
    }

    const currentSpectrum = computeSpectrum(biasCounts, totalSources)

    if (isNewSource) {
      events.push({
        id: `${storyId}-evt-${eventIndex++}`,
        timestamp: article.published_at,
        kind: 'source-added',
        sourceName: article.source_name,
        sourceBias: bias,
        description: `${article.source_name} began covering this story`,
        cumulativeSourceCount: totalSources,
        cumulativeSpectrum: currentSpectrum,
      })
    }

    if (hasSignificantShift(prevSpectrum, currentSpectrum)) {
      events.push({
        id: `${storyId}-evt-${eventIndex++}`,
        timestamp: article.published_at,
        kind: 'spectrum-shift',
        sourceName: article.source_name,
        sourceBias: bias,
        description: 'Coverage spectrum shifted significantly',
        cumulativeSourceCount: totalSources,
        cumulativeSpectrum: currentSpectrum,
      })
    }

    const milestone = checkMilestone(
      isNewSource ? totalSources - 1 : totalSources,
      totalSources
    )
    if (milestone !== null) {
      events.push({
        id: `${storyId}-evt-${eventIndex++}`,
        timestamp: article.published_at,
        kind: 'milestone',
        sourceName: article.source_name,
        sourceBias: bias,
        description: `${milestone} sources now covering this story`,
        cumulativeSourceCount: totalSources,
        cumulativeSpectrum: currentSpectrum,
      })
    }

    prevSpectrum = currentSpectrum
  }

  const firstTime = new Date(articles[0].published_at).getTime()
  const lastTime = new Date(articles[articles.length - 1].published_at).getTime()
  const timeSpanHours = Math.round((lastTime - firstTime) / (1000 * 60 * 60))

  return {
    storyId,
    events: events.slice(0, MAX_EVENTS),
    totalArticles: articles.length,
    timeSpanHours,
  }
}
