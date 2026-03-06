/**
 * __tests__/lib/api/timeline-transformer.test.ts — Unit tests for timeline transformer.
 *
 * Tests the pure function that converts articles into timeline events.
 */

import { describe, it, expect } from 'vitest'
import { transformTimeline } from '@/lib/api/timeline-transformer'
import type { ArticleWithSource } from '@/lib/api/query-helpers'

function makeArticle(overrides: Partial<ArticleWithSource> & { source_id: string; source_name: string; source_bias: string }): ArticleWithSource {
  return {
    id: `art-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Article',
    published_at: '2026-03-01T10:00:00Z',
    source_factuality: 'high',
    ...overrides,
  }
}

describe('transformTimeline', () => {
  it('returns empty events for empty input', () => {
    const result = transformTimeline('story-1', [])
    expect(result.storyId).toBe('story-1')
    expect(result.events).toHaveLength(0)
    expect(result.totalArticles).toBe(0)
    expect(result.timeSpanHours).toBe(0)
  })

  it('generates a source-added event for a single article', () => {
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'The Guardian', source_bias: 'left' }),
    ]
    const result = transformTimeline('story-1', articles)

    expect(result.events).toHaveLength(1)
    expect(result.events[0].kind).toBe('source-added')
    expect(result.events[0].sourceName).toBe('The Guardian')
    expect(result.events[0].sourceBias).toBe('left')
    expect(result.events[0].cumulativeSourceCount).toBe(1)
    expect(result.totalArticles).toBe(1)
  })

  it('generates source-added for each unique source', () => {
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'The Guardian', source_bias: 'left', published_at: '2026-03-01T10:00:00Z' }),
      makeArticle({ source_id: 's2', source_name: 'BBC News', source_bias: 'center', published_at: '2026-03-01T11:00:00Z' }),
      makeArticle({ source_id: 's3', source_name: 'Fox News', source_bias: 'right', published_at: '2026-03-01T12:00:00Z' }),
    ]
    const result = transformTimeline('story-1', articles)

    const sourceAddedEvents = result.events.filter((e) => e.kind === 'source-added')
    expect(sourceAddedEvents).toHaveLength(3)
    expect(sourceAddedEvents[0].sourceName).toBe('The Guardian')
    expect(sourceAddedEvents[1].sourceName).toBe('BBC News')
    expect(sourceAddedEvents[2].sourceName).toBe('Fox News')
  })

  it('does not duplicate source-added for the same source_id', () => {
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'The Guardian', source_bias: 'left', published_at: '2026-03-01T10:00:00Z' }),
      makeArticle({ source_id: 's1', source_name: 'The Guardian', source_bias: 'left', published_at: '2026-03-01T11:00:00Z' }),
    ]
    const result = transformTimeline('story-1', articles)

    const sourceAddedEvents = result.events.filter((e) => e.kind === 'source-added')
    expect(sourceAddedEvents).toHaveLength(1)
    expect(result.totalArticles).toBe(2)
  })

  it('generates milestone event when source count crosses threshold 5', () => {
    const biases = ['left', 'center', 'right', 'lean-left', 'lean-right']
    const articles: ArticleWithSource[] = Array.from({ length: 5 }, (_, i) =>
      makeArticle({
        source_id: `s${i + 1}`,
        source_name: `Source ${i + 1}`,
        source_bias: biases[i],
        published_at: `2026-03-01T${(10 + i).toString().padStart(2, '0')}:00:00Z`,
      })
    )
    const result = transformTimeline('story-1', articles)

    const milestones = result.events.filter((e) => e.kind === 'milestone')
    expect(milestones).toHaveLength(1)
    expect(milestones[0].cumulativeSourceCount).toBe(5)
    expect(milestones[0].description).toContain('5')
  })

  it('generates milestone event when source count crosses threshold 10', () => {
    const biases = ['left', 'center', 'right', 'lean-left', 'lean-right', 'far-left', 'far-right', 'left', 'center', 'right']
    const articles: ArticleWithSource[] = Array.from({ length: 10 }, (_, i) =>
      makeArticle({
        source_id: `s${i + 1}`,
        source_name: `Source ${i + 1}`,
        source_bias: biases[i],
        published_at: `2026-03-01T${(10 + i).toString().padStart(2, '0')}:00:00Z`,
      })
    )
    const result = transformTimeline('story-1', articles)

    const milestones = result.events.filter((e) => e.kind === 'milestone')
    expect(milestones).toHaveLength(2) // threshold 5 and 10
  })

  it('generates spectrum-shift when distribution swings >=15 points', () => {
    // Start with 3 left sources, then add 3 right sources to create a big swing
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'Source 1', source_bias: 'left', published_at: '2026-03-01T10:00:00Z' }),
      makeArticle({ source_id: 's2', source_name: 'Source 2', source_bias: 'left', published_at: '2026-03-01T11:00:00Z' }),
      makeArticle({ source_id: 's3', source_name: 'Source 3', source_bias: 'left', published_at: '2026-03-01T12:00:00Z' }),
      makeArticle({ source_id: 's4', source_name: 'Source 4', source_bias: 'right', published_at: '2026-03-01T13:00:00Z' }),
      makeArticle({ source_id: 's5', source_name: 'Source 5', source_bias: 'right', published_at: '2026-03-01T14:00:00Z' }),
      makeArticle({ source_id: 's6', source_name: 'Source 6', source_bias: 'right', published_at: '2026-03-01T15:00:00Z' }),
    ]
    const result = transformTimeline('story-1', articles)

    const shiftEvents = result.events.filter((e) => e.kind === 'spectrum-shift')
    expect(shiftEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT generate spectrum-shift for minor changes', () => {
    // All sources have the same bias → no shift
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'Source 1', source_bias: 'center', published_at: '2026-03-01T10:00:00Z' }),
      makeArticle({ source_id: 's2', source_name: 'Source 2', source_bias: 'center', published_at: '2026-03-01T11:00:00Z' }),
      makeArticle({ source_id: 's3', source_name: 'Source 3', source_bias: 'center', published_at: '2026-03-01T12:00:00Z' }),
    ]
    const result = transformTimeline('story-1', articles)

    const shiftEvents = result.events.filter((e) => e.kind === 'spectrum-shift')
    expect(shiftEvents).toHaveLength(0)
  })

  it('includes correct cumulativeSpectrum at each event', () => {
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'The Guardian', source_bias: 'left', published_at: '2026-03-01T10:00:00Z' }),
      makeArticle({ source_id: 's2', source_name: 'BBC News', source_bias: 'center', published_at: '2026-03-01T11:00:00Z' }),
    ]
    const result = transformTimeline('story-1', articles)

    // First event: 100% left
    const firstSpectrum = result.events[0].cumulativeSpectrum
    const leftSeg = firstSpectrum.find((s) => s.bias === 'left')
    expect(leftSeg?.percentage).toBe(100)

    // Second event: 50% left, 50% center
    const lastEvent = result.events[result.events.length - 1]
    const leftSeg2 = lastEvent.cumulativeSpectrum.find((s) => s.bias === 'left')
    const centerSeg = lastEvent.cumulativeSpectrum.find((s) => s.bias === 'center')
    expect(leftSeg2?.percentage).toBe(50)
    expect(centerSeg?.percentage).toBe(50)
  })

  it('calculates correct timeSpanHours', () => {
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'Source 1', source_bias: 'left', published_at: '2026-03-01T10:00:00Z' }),
      makeArticle({ source_id: 's2', source_name: 'Source 2', source_bias: 'right', published_at: '2026-03-03T10:00:00Z' }),
    ]
    const result = transformTimeline('story-1', articles)

    expect(result.timeSpanHours).toBe(48)
  })

  it('caps events at 20', () => {
    // Create 25 unique sources
    const articles: ArticleWithSource[] = Array.from({ length: 25 }, (_, i) =>
      makeArticle({
        source_id: `s${i + 1}`,
        source_name: `Source ${i + 1}`,
        source_bias: i % 2 === 0 ? 'left' : 'right',
        published_at: `2026-03-01T${(10 + Math.floor(i / 2)).toString().padStart(2, '0')}:${(i % 2 === 0 ? '00' : '30')}:00Z`,
      })
    )
    const result = transformTimeline('story-1', articles)

    expect(result.events.length).toBeLessThanOrEqual(20)
  })

  it('assigns unique IDs to each event', () => {
    const articles: ArticleWithSource[] = [
      makeArticle({ source_id: 's1', source_name: 'Source 1', source_bias: 'left', published_at: '2026-03-01T10:00:00Z' }),
      makeArticle({ source_id: 's2', source_name: 'Source 2', source_bias: 'right', published_at: '2026-03-01T11:00:00Z' }),
    ]
    const result = transformTimeline('story-1', articles)

    const ids = result.events.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
