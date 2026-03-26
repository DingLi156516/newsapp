/**
 * Story intelligence — pure functions that compute narrative coverage analysis.
 * Ported from web lib/story-intelligence.ts with mobile type imports.
 */

import type { NewsArticle, OwnershipType, StoryTimeline } from '@/lib/shared/types'
import { OWNERSHIP_LABELS } from '@/lib/shared/types'

interface CoverageSplit {
  left: number
  center: number
  right: number
}

export interface StoryIntelligence {
  overview: string
  momentumSummary: string
  coverageGapSummary: string
  framingDeltaSummary: string
  methodologySummary: string
  ownershipSummary: string
}

function rollupCoverage(article: NewsArticle): CoverageSplit {
  return article.spectrumSegments.reduce<CoverageSplit>((totals, segment) => {
    if (segment.bias === 'center') {
      return { ...totals, center: totals.center + segment.percentage }
    }
    if (segment.bias === 'left' || segment.bias === 'lean-left' || segment.bias === 'far-left') {
      return { ...totals, left: totals.left + segment.percentage }
    }
    return { ...totals, right: totals.right + segment.percentage }
  }, { left: 0, center: 0, right: 0 })
}

function dominantLane(split: CoverageSplit): 'left' | 'center' | 'right' {
  if (split.center >= split.left && split.center >= split.right) return 'center'
  if (split.right >= split.left) return 'right'
  return 'left'
}

function formatOwnershipLabel(ownership: OwnershipType): string {
  return OWNERSHIP_LABELS[ownership].toLowerCase()
}

function buildOwnershipSummary(article: NewsArticle): string {
  const counts = new Map<OwnershipType, number>()

  for (const source of article.sources) {
    counts.set(source.ownership, (counts.get(source.ownership) ?? 0) + 1)
  }

  const parts = [...counts.entries()]
    .map(([ownership, count]) => `${formatOwnershipLabel(ownership)} (${count})`)

  if (parts.length === 0) {
    return 'Ownership data is not available for this story yet.'
  }

  const formatted = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`

  return `Ownership mix spans ${parts.length} model${parts.length === 1 ? '' : 's'}: ${formatted}.`
}

function rollupSpectrum(segments: readonly { bias: string; percentage: number }[]): CoverageSplit {
  return segments.reduce<CoverageSplit>((totals, segment) => {
    if (segment.bias === 'center') {
      return { ...totals, center: totals.center + segment.percentage }
    }
    if (segment.bias === 'left' || segment.bias === 'lean-left' || segment.bias === 'far-left') {
      return { ...totals, left: totals.left + segment.percentage }
    }
    return { ...totals, right: totals.right + segment.percentage }
  }, { left: 0, center: 0, right: 0 })
}

function extractSummaryLead(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/^[•*-]\s*/, '').trim())
    .find(Boolean) ?? 'additional reporting context'
}

function summarizeLaneSpread(split: CoverageSplit, mode: 'opening' | 'latest'): string {
  const active = [
    split.left > 0 ? 'left' : null,
    split.center > 0 ? 'center' : null,
    split.right > 0 ? 'right' : null,
  ].filter(Boolean) as Array<'left' | 'center' | 'right'>

  if (active.length === 1) {
    return `${active[0]}-only coverage`
  }

  if (active.length === 2) {
    const joined = `${active[0]} and ${active[1]} lanes`
    return mode === 'opening' ? joined : `include ${joined}`
  }

  return mode === 'opening'
    ? 'left, center, and right lanes'
    : 'include left, center, and right lanes'
}

function buildTimelineSummary(timeline: StoryTimeline | null): string {
  if (!timeline || timeline.events.length === 0) {
    return 'Coverage momentum will become clearer as more sources join this story.'
  }

  const firstEvent = timeline.events[0]
  const latestEvent = timeline.events[timeline.events.length - 1]
  const openingLanes = summarizeLaneSpread(rollupSpectrum(firstEvent.cumulativeSpectrum), 'opening')
  const latestLanes = summarizeLaneSpread(rollupSpectrum(latestEvent.cumulativeSpectrum), 'latest')

  if (openingLanes !== latestLanes) {
    return `${firstEvent.sourceName} opened coverage, and the story grew to ${latestEvent.cumulativeSourceCount} sources over ${timeline.timeSpanHours} hours. The spectrum widened from ${openingLanes} to ${latestLanes}.`
  }

  return `${firstEvent.sourceName} opened coverage, and the story grew to ${latestEvent.cumulativeSourceCount} sources over ${timeline.timeSpanHours} hours while staying within ${latestLanes}.`
}

function buildCoverageGapSummary(split: CoverageSplit): string {
  const dominant = dominantLane(split)
  const dominantPercent = split[dominant]

  const sorted: Array<[string, number]> = [
    ['left', split.left],
    ['center', split.center],
    ['right', split.right],
  ]

  sorted.sort((a, b) => a[1] - b[1])

  if (dominantPercent >= 70) {
    const otherLanes = (['left', 'center', 'right'] as const)
      .filter(lane => lane !== dominant)
      .map(lane => `${split[lane]}% ${lane}`)

    return `Coverage gap: the story is heavily ${dominant}-weighted, with only ${otherLanes[0]} coverage and ${otherLanes[1]} coverage.`
  }

  if (sorted[0][1] === 0) {
    return `Coverage gap: ${sorted[0][0]} coverage is missing from the current source mix.`
  }

  if (sorted[0][1] < 15) {
    return `Coverage gap: ${sorted[0][0]} is the thinnest lane at ${sorted[0][1]}%, so it is worth checking additional sources from that perspective.`
  }

  return 'No major coverage gap is visible: left, center, and right lanes are all represented in the current source mix.'
}

export function buildStoryIntelligence(
  article: NewsArticle,
  timeline: StoryTimeline | null = null
): StoryIntelligence {
  const split = rollupCoverage(article)
  const dominant = dominantLane(split)
  const activeLaneCount = [split.left, split.center, split.right].filter(value => value > 0).length
  const commonGroundLead = extractSummaryLead(article.aiSummary.commonGround)
  const leftLead = extractSummaryLead(article.aiSummary.leftFraming)
  const rightLead = extractSummaryLead(article.aiSummary.rightFraming)

  return {
    overview: `Coverage leans ${dominant} overall: ${split.left}% left, ${split.center}% center, ${split.right}% right.`,
    momentumSummary: buildTimelineSummary(timeline),
    coverageGapSummary: buildCoverageGapSummary(split),
    framingDeltaSummary: `Shared reporting centers on ${commonGroundLead}. Left-leaning coverage emphasizes ${leftLead}, while right-leaning coverage emphasizes ${rightLead}.`,
    methodologySummary: `This view combines ${article.sourceCount} sources across ${activeLaneCount} active lane${activeLaneCount === 1 ? '' : 's'}. Blindspot flags trigger when one lane dominates coverage, and the timeline updates as new sources join the cluster.`,
    ownershipSummary: buildOwnershipSummary(article),
  }
}
