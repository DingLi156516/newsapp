/**
 * Tests for lib/ai/story-assembler.ts — assembleSingleStory and assembleStories.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/headline-generator', () => ({
  generateNeutralHeadline: vi.fn(),
}))

vi.mock('@/lib/ai/summary-generator', () => ({
  generateAISummary: vi.fn(),
  generateSingleSourceSummary: vi.fn(),
  isFallbackSummary: vi.fn(() => false),
}))

vi.mock('@/lib/ai/topic-classifier', () => ({
  classifyTopic: vi.fn(),
}))

vi.mock('@/lib/ai/region-classifier', () => ({
  classifyRegion: vi.fn(),
}))

vi.mock('@/lib/ai/spectrum-calculator', () => ({
  calculateSpectrum: vi.fn(),
}))

vi.mock('@/lib/ai/blindspot-detector', () => ({
  isBlindspot: vi.fn(),
}))

vi.mock('@/lib/ai/entity-extractor', () => ({
  extractEntities: vi.fn(),
}))

vi.mock('@/lib/ai/tag-upsert', () => ({
  upsertStoryTags: vi.fn(),
}))

import type { Region, Topic } from '@/lib/types'
import { assembleSingleStory, assembleStories } from '@/lib/ai/story-assembler'
import { generateNeutralHeadline } from '@/lib/ai/headline-generator'
import { generateAISummary, generateSingleSourceSummary } from '@/lib/ai/summary-generator'
import { classifyTopic } from '@/lib/ai/topic-classifier'
import { classifyRegion } from '@/lib/ai/region-classifier'
import { calculateSpectrum } from '@/lib/ai/spectrum-calculator'
import { isBlindspot } from '@/lib/ai/blindspot-detector'
import { extractEntities } from '@/lib/ai/entity-extractor'
import { upsertStoryTags } from '@/lib/ai/tag-upsert'

const mockHeadline = vi.mocked(generateNeutralHeadline)
const mockSummary = vi.mocked(generateAISummary)
const mockSingleSourceSummary = vi.mocked(generateSingleSourceSummary)
const mockTopic = vi.mocked(classifyTopic)
const mockRegion = vi.mocked(classifyRegion)
const mockSpectrum = vi.mocked(calculateSpectrum)
const mockBlindspot = vi.mocked(isBlindspot)
const mockExtractEntities = vi.mocked(extractEntities)
const mockUpsertStoryTags = vi.mocked(upsertStoryTags)

function headlineResult(headline: string) {
  return { headline, usedCheapModel: true, usedFallback: false }
}

function topicResult(topic: Topic) {
  return { topic, usedCheapModel: true, usedFallback: false }
}

function regionResult(region: Region) {
  return { region, usedCheapModel: true, usedFallback: false }
}

function createMockClient(overrides: {
  articles?: { data: unknown[] | null; error: unknown | null }
  sources?: { data: unknown[] | null; error: unknown | null }
  stories?: { data: unknown[] | null; error: unknown | null }
  updateError?: unknown | null
} = {}) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: overrides.updateError ?? null }),
  })

  const storyReturns = vi.fn().mockResolvedValue(
    overrides.stories ?? { data: [], error: null }
  )

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'articles') {
      const articlesResult = overrides.articles ?? { data: [], error: null }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                returns: vi.fn().mockResolvedValue(articlesResult),
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'sources') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            returns: vi.fn().mockResolvedValue(
              overrides.sources ?? { data: [], error: null }
            ),
          }),
        }),
      }
    }
    if (table === 'stories') {
      return {
        select: vi.fn().mockImplementation((columns: string) => {
          if (columns === 'first_published') {
            return {
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { first_published: '2026-03-22T10:00:00Z' },
                  error: null,
                }),
              }),
            }
          }
          return {
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    returns: storyReturns,
                  }),
                }),
              }),
              returns: storyReturns,
            }),
          }
        }),
        update: updateFn,
      }
    }
    return {}
  })

  return { from: fromFn, _updateFn: updateFn }
}

describe('assembleSingleStory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates headline, topic, and summary for a story', async () => {
    const articles = [
      { id: 'a1', title: 'Article One', description: 'Desc 1', source_id: 's1', image_url: 'img.jpg', published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Article Two', description: 'Desc 2', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'right', factuality: 'mixed', ownership: 'independent' },
    ]

    mockHeadline.mockResolvedValue(headlineResult('Generated Headline'))
    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
    mockSummary.mockResolvedValue({
      aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })
    mockSpectrum.mockReturnValue([
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([
      { label: 'Test Entity', type: 'person', relevance: 0.9 },
    ])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    await assembleSingleStory(client as never, 'story-1')

    expect(mockHeadline).toHaveBeenCalledWith(['Article One', 'Article Two'])
    expect(mockTopic).toHaveBeenCalledWith(['Article One', 'Article Two'])
    expect(mockSummary).toHaveBeenCalledOnce()
    expect(mockExtractEntities).toHaveBeenCalledWith(
      ['Article One', 'Article Two'],
      ['Desc 1', 'Desc 2']
    )
    expect(mockUpsertStoryTags).toHaveBeenCalledWith(
      expect.anything(),
      'story-1',
      [{ label: 'Test Entity', type: 'person', relevance: 0.9 }]
    )
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Generated Headline',
        topic: 'politics',
        source_count: 2,
        is_blindspot: false,
        image_url: 'img.jpg',
        assembly_status: 'completed',
        publication_status: 'published',
        review_status: 'approved',
        review_reasons: [],
        processing_error: null,
        assembled_at: expect.any(String),
        published_at: expect.any(String),
        confidence_score: expect.any(Number),
      })
    )
  })

  it('uses original title and single-source summary for single-source stories', async () => {
    const articles = [
      { id: 'a1', title: 'Original Article Title', description: 'Desc', source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
    ]

    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
    mockSingleSourceSummary.mockResolvedValue({
      aiSummary: { commonGround: '• Key facts here', leftFraming: '', rightFraming: '' },
      sentiment: null,
      keyQuotes: null,
      keyClaims: [{ claim: 'A claim', side: 'both', disputed: false }],
    })
    mockSpectrum.mockReturnValue([{ bias: 'left', percentage: 100 }])
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    await assembleSingleStory(client as never, 'story-1')

    // Should NOT call generateNeutralHeadline or generateAISummary
    expect(mockHeadline).not.toHaveBeenCalled()
    expect(mockSummary).not.toHaveBeenCalled()

    // Should call single-source summary
    expect(mockSingleSourceSummary).toHaveBeenCalledWith({
      title: 'Original Article Title',
      description: 'Desc',
      bias: 'left',
    })

    // Should use original title as headline
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Original Article Title',
        is_blindspot: false,
        controversy_score: 0,
        source_count: 1,
      })
    )
  })

  it('throws when no articles found', async () => {
    const client = createMockClient({
      articles: { data: [], error: null },
    })

    await expect(
      assembleSingleStory(client as never, 'story-1')
    ).rejects.toThrow('No articles found for story story-1')
  })

  it('throws on articles fetch error', async () => {
    const client = createMockClient({
      articles: { data: null, error: { message: 'DB error' } },
    })

    await expect(
      assembleSingleStory(client as never, 'story-1')
    ).rejects.toThrow('Failed to fetch articles for story story-1')
  })

  it('throws on sources fetch error', async () => {
    const articles = [
      { id: 'a1', title: 'Title', description: null, source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
    ]

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: null, error: { message: 'Source DB error' } },
    })

    await expect(
      assembleSingleStory(client as never, 'story-1')
    ).rejects.toThrow('Failed to fetch sources for story story-1')
  })

  it('does not throw when tag upsert fails', async () => {
    const articles = [
      { id: 'a1', title: 'Article One', description: 'Desc 1', source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Article Two', description: 'Desc 2', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'right', factuality: 'high', ownership: 'independent' },
    ]

    mockHeadline.mockResolvedValue(headlineResult('Headline'))
    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
    mockSummary.mockResolvedValue({ aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' }, sentiment: null, keyQuotes: null, keyClaims: null })
    mockSpectrum.mockReturnValue([
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([{ label: 'Test', type: 'person', relevance: 0.9 }])
    mockUpsertStoryTags.mockRejectedValue(new Error('Tag DB error'))

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    // Should not throw even though upsertStoryTags fails
    const result = await assembleSingleStory(client as never, 'story-1')
    expect(result.publicationStatus).toBe('published')
    expect(result.tagError).toBe('Entity tagging failed for story-1: Tag DB error')
    expect(mockUpsertStoryTags).toHaveBeenCalledOnce()
  })

  it('throws on update error', async () => {
    const articles = [
      { id: 'a1', title: 'Title', description: null, source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'center', factuality: 'high', ownership: 'corporate' },
    ]

    mockHeadline.mockResolvedValue(headlineResult('Headline'))
    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
    mockSummary.mockResolvedValue({ aiSummary: { commonGround: '', leftFraming: '', rightFraming: '' }, sentiment: null, keyQuotes: null, keyClaims: null })
    mockSpectrum.mockReturnValue([])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
      updateError: { message: 'Update failed' },
    })

    await expect(
      assembleSingleStory(client as never, 'story-1')
    ).rejects.toThrow('Failed to update story story-1')
  })
})

describe('assembleStories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns zero processed when no pending stories', async () => {
    const client = createMockClient({
      stories: { data: [], error: null },
    })

    const result = await assembleStories(client as never)

    expect(result).toEqual(expect.objectContaining({
      storiesProcessed: 0,
      claimedStories: 0,
      autoPublished: 0,
      sentToReview: 0,
      errors: [],
    }))
  })

  it('throws when fetching pending stories fails', async () => {
    const client = createMockClient({
      stories: { data: null, error: { message: 'Query failed' } },
    })

    await expect(assembleStories(client as never)).rejects.toThrow(
      'Failed to fetch pending stories'
    )
  })

  it('claims pending stories by assembly status and tracks publish counts', async () => {
    const articles = [
      { id: 'a1', title: 'Article One', description: 'Desc 1', source_id: 's1', image_url: 'img.jpg', published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Article Two', description: 'Desc 2', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'right', factuality: 'high', ownership: 'independent' },
    ]

    mockHeadline.mockResolvedValue(headlineResult('Generated Headline'))
    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
    mockSummary.mockResolvedValue({
      aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })
    mockSpectrum.mockReturnValue([
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      stories: { data: [{ id: 'story-1', first_published: '2026-03-22T10:00:00Z' }], error: null },
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    const result = await assembleStories(client as never, 10)

    expect(result.claimedStories).toBe(1)
    expect(result.storiesProcessed).toBe(1)
    expect(result.autoPublished).toBe(1)
    expect(result.sentToReview).toBe(0)
  })

  it('skips freshly claimed pending stories but processes stale claims', async () => {
    const articles = [
      { id: 'a1', title: 'Article One', description: 'Desc 1', source_id: 's1', image_url: 'img.jpg', published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Article Two', description: 'Desc 2', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'right', factuality: 'high', ownership: 'independent' },
    ]

    mockHeadline.mockResolvedValue(headlineResult('Generated Headline'))
    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
    mockSummary.mockResolvedValue({
      aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })
    mockSpectrum.mockReturnValue([
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      stories: {
        data: [
          { id: 'story-1', assembly_claimed_at: null, first_published: '2026-03-22T10:00:00Z' },
          { id: 'story-2', assembly_claimed_at: '2026-03-22T10:45:00Z', first_published: '2026-03-22T10:00:00Z' },
          { id: 'story-3', assembly_claimed_at: '2026-03-22T11:45:00Z', first_published: '2026-03-22T10:00:00Z' },
        ],
        error: null,
      },
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    const result = await assembleStories(client as never, 10)

    expect(result.claimedStories).toBe(2)
    expect(result.storiesProcessed).toBe(2)
    expect(result.autoPublished).toBe(2)
  })

  it('processes multiple stories concurrently when a concurrency cap is provided', async () => {
    const articles = [
      { id: 'a1', title: 'Article One', description: 'Desc 1', source_id: 's1', image_url: 'img.jpg', published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Article Two', description: 'Desc 2', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'right', factuality: 'high', ownership: 'independent' },
    ]
    const summaryResolvers: Array<(value: { aiSummary: { commonGround: string; leftFraming: string; rightFraming: string }; sentiment: null; keyQuotes: null; keyClaims: null }) => void> = []

    mockHeadline.mockResolvedValue(headlineResult('Generated Headline'))
    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
    mockSummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          summaryResolvers.push(resolve)
        })
    )
    mockSpectrum.mockReturnValue([
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      stories: {
        data: [
          { id: 'story-1', assembly_claimed_at: null, first_published: '2026-03-22T10:00:00Z' },
          { id: 'story-2', assembly_claimed_at: null, first_published: '2026-03-22T10:00:00Z' },
        ],
        error: null,
      },
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    const resultPromise = assembleStories(client as never, 10, { concurrency: 2 })
    for (let i = 0; i < 8; i++) {
      await Promise.resolve()
    }

    expect(mockSummary).toHaveBeenCalledTimes(2)

    for (const resolve of summaryResolvers) {
      resolve({ aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' }, sentiment: null, keyQuotes: null, keyClaims: null })
    }

    const result = await resultPromise
    expect(result.storiesProcessed).toBe(2)
    expect(result.autoPublished).toBe(2)
  })
})
