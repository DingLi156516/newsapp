/**
 * Tests for lib/ai/story-assembler.ts — assembleSingleStory and assembleStories.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/ai/story-classifier', () => ({
  classifyStory: vi.fn(),
}))

vi.mock('@/lib/ai/summary-generator', () => ({
  generateAISummary: vi.fn(),
  generateSingleSourceSummary: vi.fn(),
  isFallbackSummary: vi.fn(() => false),
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
import { assembleSingleStory, assembleStories, scheduleTagExtraction } from '@/lib/ai/story-assembler'
import { classifyStory } from '@/lib/ai/story-classifier'
import { generateAISummary, generateSingleSourceSummary } from '@/lib/ai/summary-generator'
import { calculateSpectrum } from '@/lib/ai/spectrum-calculator'
import { isBlindspot } from '@/lib/ai/blindspot-detector'
import { extractEntities } from '@/lib/ai/entity-extractor'
import { upsertStoryTags } from '@/lib/ai/tag-upsert'

const mockClassifyStory = vi.mocked(classifyStory)
const mockSummary = vi.mocked(generateAISummary)
const mockSingleSourceSummary = vi.mocked(generateSingleSourceSummary)
const mockSpectrum = vi.mocked(calculateSpectrum)
const mockBlindspot = vi.mocked(isBlindspot)
const mockExtractEntities = vi.mocked(extractEntities)
const mockUpsertStoryTags = vi.mocked(upsertStoryTags)
const ORIGINAL_ASSEMBLY_MODE = process.env.PIPELINE_ASSEMBLY_MODE

// The pipeline default is the deterministic assembly path; these tests opt
// into the legacy Gemini path explicitly. One integration test below deletes
// this env var to exercise the deterministic-by-default behavior.
beforeEach(() => {
  process.env.PIPELINE_ASSEMBLY_MODE = 'gemini'
})

afterEach(() => {
  if (ORIGINAL_ASSEMBLY_MODE === undefined) {
    delete process.env.PIPELINE_ASSEMBLY_MODE
  } else {
    process.env.PIPELINE_ASSEMBLY_MODE = ORIGINAL_ASSEMBLY_MODE
  }
})

function classificationResult(headline: string, topic: Topic = 'politics', region: Region = 'us') {
  return { 
    headline, 
    topic, 
    region, 
    usedCheapModel: true, 
    headlineFallback: false,
    topicFallback: false,
    regionFallback: false
  }
}

const ASSEMBLY_TTL_MS = 60 * 60 * 1000

interface MockStoryRow {
  id: string
  assembly_claimed_at?: string | null
  first_published: string
}

function createMockClient(overrides: {
  articles?: { data: unknown[] | null; error: unknown | null }
  sources?: { data: unknown[] | null; error: unknown | null }
  stories?: { data: unknown[] | null; error: unknown | null }
  updateError?: unknown | null
  fetchMetadataError?: unknown | null
} = {}) {
  // Thenable update chain: supports BOTH
  //   .update(payload).eq('id', storyId) → admin/backfill path
  //   .update(payload, { count: 'exact' }).eq('id', storyId).eq('assembly_claim_owner', owner) → cron path
  const updateResolved = {
    error: overrides.updateError ?? null,
    count: overrides.updateError ? null : 1,
  }
  const ownerEq = vi.fn().mockResolvedValue(updateResolved)
  const idEq = vi.fn().mockImplementation(() =>
    Object.assign(Promise.resolve(updateResolved), { eq: ownerEq })
  )
  const updateFn = vi.fn().mockReturnValue({ eq: idEq })
  const insertFn = vi.fn().mockResolvedValue({ error: null })

  const storiesData = (overrides.stories?.data ?? []) as MockStoryRow[]
  const storiesError = overrides.stories?.error ?? null
  const fetchMetadataError = overrides.fetchMetadataError ?? storiesError

  // --- RPC mock: claim + release ---
  const rpc = vi.fn((name: string, args: { p_owner?: string; p_limit?: number }) => {
    if (name === 'claim_stories_for_assembly') {
      if (storiesError) return Promise.resolve({ data: null, error: null })
      const now = Date.now()
      const claimable = storiesData.filter((s) => {
        const claimedAt = s.assembly_claimed_at ?? null
        if (!claimedAt) return true
        const claimedMs = new Date(claimedAt).getTime()
        return Number.isNaN(claimedMs) || now - claimedMs >= ASSEMBLY_TTL_MS
      })
      const limit = args.p_limit ?? claimable.length
      return Promise.resolve({ data: claimable.slice(0, limit).map((s) => s.id), error: null })
    }
    if (name === 'release_assembly_claim') {
      return Promise.resolve({ data: true, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

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
          // thin-topic-classifier priors query:
          // .in(...).gt('stories.first_published', cutoff).eq('stories.assembly_status', 'completed')
          in: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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
          // Path A: assembleSingleStory reads first_published.
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
          // Path B: assembleStories fetches metadata for claimed IDs.
          if (columns === 'id, first_published') {
            const inFn = vi.fn((_col: string, ids: string[]) => {
              if (fetchMetadataError) {
                return Promise.resolve({ data: null, error: fetchMetadataError })
              }
              const bySet = new Set(ids)
              const rows = storiesData
                .filter((s) => bySet.has(s.id))
                .map((s) => ({ id: s.id, first_published: s.first_published }))
              return Promise.resolve({ data: rows, error: null })
            })
            return { in: inFn }
          }
          // Path C: runOwnerScopedUpdate verify-read on zero-match (never
          // triggered in happy path — count:1 short-circuits).
          if (columns === 'assembly_claim_owner') {
            return {
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }
          }
          // Path D: failure path reads the retry count.
          if (columns === 'assembly_retry_count') {
            return {
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { assembly_retry_count: 0 },
                  error: null,
                }),
              }),
            }
          }
          return {}
        }),
        update: updateFn,
      }
    }
    if (table === 'pipeline_dead_letter') {
      return { insert: insertFn }
    }
    return {}
  })

  return { from: fromFn, rpc, _updateFn: updateFn, _rpc: rpc, _insert: insertFn }
}

// --- Phase 10: mock client where the owner-scoped story update matches
//     zero rows and the verify-read shows a different assembly_claim_owner.
//     Used for stale-worker race tests. ---
function createMockClientWithOwnershipMovedStories(opts: {
  stories: MockStoryRow[]
  articles: unknown[]
  sources: unknown[]
  takeoverOwner: string
  assemblyRetryCount?: number
}) {
  // Update chain: .update(payload, { count: 'exact' }).eq('id').eq('assembly_claim_owner', owner)
  //   returns { error: null, count: 0 } on every call (zero-match)
  const zeroMatch = { error: null, count: 0 }
  const ownerEq = vi.fn().mockResolvedValue(zeroMatch)
  const idEq = vi.fn().mockImplementation(() =>
    Object.assign(Promise.resolve(zeroMatch), { eq: ownerEq })
  )
  const updateFn = vi.fn().mockReturnValue({ eq: idEq })

  const insertFn = vi.fn().mockResolvedValue({ error: null })

  const retryCount = opts.assemblyRetryCount ?? 0

  const rpc = vi.fn((name: string, args: { p_owner?: string; p_limit?: number }) => {
    if (name === 'claim_stories_for_assembly') {
      const limit = args.p_limit ?? opts.stories.length
      return Promise.resolve({
        data: opts.stories.slice(0, limit).map((s) => s.id),
        error: null,
      })
    }
    if (name === 'release_assembly_claim' || name === 'bump_assembly_version') {
      return Promise.resolve({ data: true, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'articles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                returns: vi.fn().mockResolvedValue({
                  data: opts.articles,
                  error: null,
                }),
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
            returns: vi.fn().mockResolvedValue({
              data: opts.sources,
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'stories') {
      return {
        select: vi.fn().mockImplementation((columns: string) => {
          // metadata fetch for claimed IDs
          if (columns === 'id, first_published') {
            return {
              in: vi.fn((_col: string, ids: string[]) => {
                const bySet = new Set(ids)
                const rows = opts.stories
                  .filter((s) => bySet.has(s.id))
                  .map((s) => ({ id: s.id, first_published: s.first_published }))
                return Promise.resolve({ data: rows, error: null })
              }),
            }
          }
          // first_published fallback read inside assembleSingleStory
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
          // runOwnerScopedUpdate verify-read: stale claim belongs to takeoverOwner
          if (columns === 'assembly_claim_owner') {
            return {
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { assembly_claim_owner: opts.takeoverOwner },
                  error: null,
                }),
              }),
            }
          }
          // failure path reads current retry count
          if (columns === 'assembly_retry_count') {
            return {
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { assembly_retry_count: retryCount },
                  error: null,
                }),
              }),
            }
          }
          return {}
        }),
        update: updateFn,
      }
    }
    if (table === 'pipeline_dead_letter') {
      return { insert: insertFn }
    }
    return {}
  })

  return {
    from: fromFn,
    rpc,
    _updateFn: updateFn,
    _rpc: rpc,
    _insert: insertFn,
  }
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

    mockClassifyStory.mockResolvedValue(classificationResult('Generated Headline', 'politics', 'us'))
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

    expect(mockClassifyStory).toHaveBeenCalledWith(['Article One', 'Article Two'])
    expect(mockSummary).toHaveBeenCalledOnce()
    expect(mockExtractEntities).toHaveBeenCalledWith(
      ['Article One', 'Article Two'],
      ['Desc 1', 'Desc 2']
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

    mockClassifyStory.mockResolvedValue(classificationResult('Generated Headline', 'politics', 'us'))
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

    expect(mockSummary).not.toHaveBeenCalled()

    expect(mockSingleSourceSummary).toHaveBeenCalledWith({
      title: 'Original Article Title',
      description: 'Desc',
      bias: 'left',
    })

    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Original Article Title',
        is_blindspot: false,
        controversy_score: 0,
        source_count: 1,
      })
    )
  })

  it('uses deterministic assembly for thin clusters (2 sources below rich threshold)', async () => {
    delete process.env.PIPELINE_ASSEMBLY_MODE
    const articles = [
      {
        id: 'a1',
        title: 'Senate passes climate bill after marathon vote',
        description: 'The bill expands clean energy tax credits.',
        source_id: 's1',
        image_url: null,
        published_at: '2026-03-22T10:00:00Z',
      },
      {
        id: 'a2',
        title: 'Climate bill clears Senate with new spending',
        description: 'Republicans criticized the package as costly.',
        source_id: 's2',
        image_url: null,
        published_at: '2026-03-22T11:00:00Z',
      },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'right', factuality: 'high', ownership: 'independent' },
    ]

    mockSpectrum.mockReturnValue([
      { bias: 'left', percentage: 50 },
      { bias: 'right', percentage: 50 },
    ])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    const result = await assembleSingleStory(client as never, 'story-1')

    expect(result.cheapModelTasks).toBe(0)
    expect(result.cheapModelFallbacks).toBe(0)
    expect(result.summaryFallback).toBe(false)
    expect(mockClassifyStory).not.toHaveBeenCalled()
    expect(mockSummary).not.toHaveBeenCalled()
    expect(mockSingleSourceSummary).not.toHaveBeenCalled()
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Climate bill clears Senate with new spending',
        topic: 'environment',
        region: 'us',
        ai_summary: expect.objectContaining({
          commonGround: expect.stringContaining('• Climate bill clears Senate with new spending'),
          leftFraming: expect.stringContaining('• Senate passes climate bill after marathon vote'),
          rightFraming: expect.stringContaining('• Climate bill clears Senate with new spending'),
        }),
        sentiment: null,
        key_quotes: null,
        key_claims: expect.arrayContaining([
          expect.objectContaining({
            claim: 'Climate bill clears Senate with new spending',
            side: 'both',
            disputed: false,
          }),
        ]),
      })
    )
  })

  it('uses rich Gemini path for 3-source L/C/R clusters with unset mode', async () => {
    delete process.env.PIPELINE_ASSEMBLY_MODE
    const articles = [
      { id: 'a1', title: 'Left take on policy', description: 'Desc L', source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Centrist analysis of policy', description: 'Desc C', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
      { id: 'a3', title: 'Right rebuttal of policy', description: 'Desc R', source_id: 's3', image_url: null, published_at: '2026-03-22T12:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'center', factuality: 'high', ownership: 'independent' },
      { id: 's3', bias: 'right', factuality: 'high', ownership: 'corporate' },
    ]

    mockClassifyStory.mockResolvedValue(classificationResult('Rich headline', 'politics', 'us'))
    // Quote text and claim must appear in source articles — otherwise the
    // verify-regenerate wrapper treats them as hallucinations and retries.
    mockSummary.mockResolvedValue({
      aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' },
      sentiment: { left: 'hopeful', right: 'critical' },
      keyQuotes: [{ text: 'Left take on policy', sourceName: 'Source A', sourceBias: 'left' }],
      keyClaims: [{ claim: 'Centrist analysis of policy', side: 'both', disputed: false }],
    })
    mockSpectrum.mockReturnValue([
      { bias: 'left', percentage: 33 },
      { bias: 'center', percentage: 34 },
      { bias: 'right', percentage: 33 },
    ])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    await assembleSingleStory(client as never, 'story-1')

    expect(mockClassifyStory).toHaveBeenCalledOnce()
    expect(mockSummary).toHaveBeenCalledOnce()
    expect(mockSingleSourceSummary).not.toHaveBeenCalled()
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Rich headline',
        source_count: 3,
        sentiment: { left: 'hopeful', right: 'critical' },
        key_quotes: [{ text: 'Left take on policy', sourceName: 'Source A', sourceBias: 'left' }],
      })
    )
  })

  it('zeros controversy_score for thin clusters missing one framing side', async () => {
    delete process.env.PIPELINE_ASSEMBLY_MODE
    const articles = [
      { id: 'a1', title: 'Progressive outlet covers bill details', description: 'Desc 1', source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Left-leaning analysis of the bill', description: 'Desc 2', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'far-left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'left', factuality: 'high', ownership: 'independent' },
    ]

    mockSpectrum.mockReturnValue([{ bias: 'left', percentage: 100 }])
    mockBlindspot.mockReturnValue(true)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    await assembleSingleStory(client as never, 'story-1')

    // Deterministic path leaves rightFraming='' for an all-left cluster. We
    // must NOT treat that as maximum divergence — consumers would render a
    // false HIGH DISAGREEMENT badge over what is really missing coverage.
    expect(client._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ controversy_score: 0 }),
    )
  })

  it('uses deterministic path when 3 sources all share one bias bucket (thin-by-bucket)', async () => {
    delete process.env.PIPELINE_ASSEMBLY_MODE
    const articles = [
      { id: 'a1', title: 'Progressive outlet covers bill', description: 'Desc 1', source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
      { id: 'a2', title: 'Left-leaning analysis of bill', description: 'Desc 2', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
      { id: 'a3', title: 'Progressive commentary on bill details', description: 'Desc 3', source_id: 's3', image_url: null, published_at: '2026-03-22T12:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'far-left', factuality: 'high', ownership: 'corporate' },
      { id: 's2', bias: 'left', factuality: 'high', ownership: 'independent' },
      { id: 's3', bias: 'lean-left', factuality: 'high', ownership: 'corporate' },
    ]

    mockSpectrum.mockReturnValue([{ bias: 'left', percentage: 100 }])
    mockBlindspot.mockReturnValue(true)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    const result = await assembleSingleStory(client as never, 'story-1')

    expect(mockClassifyStory).not.toHaveBeenCalled()
    expect(mockSummary).not.toHaveBeenCalled()
    expect(mockSingleSourceSummary).not.toHaveBeenCalled()
    expect(result.cheapModelTasks).toBe(0)
    expect(result.summaryFallback).toBe(false)
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

  it('throws on update error', async () => {
    const articles = [
      { id: 'a1', title: 'Title', description: null, source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'center', factuality: 'high', ownership: 'corporate' },
    ]

    mockClassifyStory.mockResolvedValue(classificationResult('Headline'))
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

  it('publishes successfully even if tag extraction fails', async () => {
    const articles = [
      { id: 'a1', title: 'Title', description: null, source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
    ]
    const sources = [
      { id: 's1', bias: 'center', factuality: 'high', ownership: 'corporate' },
    ]

    mockClassifyStory.mockResolvedValue(classificationResult('Headline'))
    mockSummary.mockResolvedValue({ aiSummary: { commonGround: '', leftFraming: '', rightFraming: '' }, sentiment: null, keyQuotes: null, keyClaims: null })
    mockSpectrum.mockReturnValue([])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockRejectedValue(new Error('Tagging error'))

    const client = createMockClient({
      articles: { data: articles, error: null },
      sources: { data: sources, error: null },
    })

    const result = await assembleSingleStory(client as never, 'story-1')
    expect(result.publicationStatus).toBe('published')
  })
})

describe('scheduleTagExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls extractEntities and upsertStoryTags on success', async () => {
    mockExtractEntities.mockResolvedValue([
      { label: 'Entity', type: 'person', relevance: 0.9 },
    ])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = { from: vi.fn() }
    scheduleTagExtraction(client as never, 'story-1', ['Title 1'], ['Desc 1'])

    await vi.waitFor(() => {
      expect(mockExtractEntities).toHaveBeenCalledWith(['Title 1'], ['Desc 1'])
    })
    await vi.waitFor(() => {
      expect(mockUpsertStoryTags).toHaveBeenCalledWith(
        client,
        'story-1',
        [{ label: 'Entity', type: 'person', relevance: 0.9 }]
      )
    })
  })

  it('logs error when extractEntities rejects', async () => {
    mockExtractEntities.mockRejectedValue(new Error('AI failure'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    scheduleTagExtraction({} as never, 'story-1', ['Title'], [null])

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[tag-processor] Tag extraction failed for story-1:',
        'AI failure'
      )
    })

    consoleSpy.mockRestore()
  })

  it('logs error when upsertStoryTags rejects', async () => {
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockRejectedValue(new Error('DB failure'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    scheduleTagExtraction({} as never, 'story-1', ['Title'], [null])

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[tag-processor] Tag extraction failed for story-1:',
        'DB failure'
      )
    })

    consoleSpy.mockRestore()
  })

  it('emits a tag_extraction_failed warn event when extraction rejects', async () => {
    mockExtractEntities.mockRejectedValue(new Error('AI failure'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const emitter = vi.fn().mockResolvedValue(undefined)

    scheduleTagExtraction({} as never, 'story-1', ['Title'], [null], emitter)

    await vi.waitFor(() => {
      expect(emitter).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'assemble',
          level: 'warn',
          eventType: 'tag_extraction_failed',
          itemId: 'story-1',
          payload: expect.objectContaining({
            storyId: 'story-1',
            error: 'AI failure',
          }),
        })
      )
    })

    consoleSpy.mockRestore()
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

  it('throws when fetching claimed story metadata fails', async () => {
    const client = createMockClient({
      stories: {
        data: [{ id: 'story-1', first_published: '2026-03-22T10:00:00Z' }],
        error: null,
      },
      fetchMetadataError: { message: 'Query failed' },
    })

    await expect(assembleStories(client as never)).rejects.toThrow(
      'Failed to fetch claimed stories'
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

    mockClassifyStory.mockResolvedValue(classificationResult('Generated Headline', 'politics', 'us'))
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

    mockClassifyStory.mockResolvedValue(classificationResult('Generated Headline', 'politics', 'us'))
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

    mockClassifyStory.mockResolvedValue(classificationResult('Generated Headline', 'politics', 'us'))
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

  it('does NOT bump assembly_version or schedule tag extraction when owner-scoped success update is zero-match', async () => {
    mockClassifyStory.mockResolvedValue(classificationResult('Generated Headline', 'politics', 'us'))
    mockSummary.mockResolvedValue({
      aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })
    mockSpectrum.mockReturnValue([])
    mockBlindspot.mockReturnValue(false)
    mockExtractEntities.mockResolvedValue([])
    mockUpsertStoryTags.mockResolvedValue(undefined)

    const client = createMockClientWithOwnershipMovedStories({
      stories: [
        { id: 'story-1', assembly_claimed_at: null, first_published: '2026-03-22T10:00:00Z' },
      ],
      articles: [
        { id: 'a1', title: 'One', description: 'Desc', source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
        { id: 'a2', title: 'Two', description: 'Desc', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
      ],
      sources: [
        { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
        { id: 's2', bias: 'right', factuality: 'high', ownership: 'independent' },
      ],
      takeoverOwner: 'other-owner',
    })

    const emitter = vi.fn().mockResolvedValue(undefined)
    const result = await assembleStories(client as never, 1, undefined, 'stale-owner', emitter)

    // Ownership-moved stories are NOT counted as processed.
    expect(result.storiesProcessed).toBe(0)
    expect(result.autoPublished).toBe(0)
    expect(result.sentToReview).toBe(0)
    // Phase 10: benign race should produce an empty errors array —
    // it's invisible to ops.
    expect(result.errors).toEqual([])

    // Tag extraction must NOT have been scheduled — the write never landed.
    expect(mockUpsertStoryTags).not.toHaveBeenCalled()

    // bump_assembly_version RPC must NOT have been called on an ownership move.
    expect(client._rpc).not.toHaveBeenCalledWith(
      'bump_assembly_version',
      expect.anything()
    )

    // Info event for the benign race.
    expect(emitter).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'assemble',
        level: 'info',
        eventType: 'ownership_moved',
        itemId: 'story-1',
        payload: expect.objectContaining({
          phase: 'success',
          previousOwner: 'stale-owner',
        }),
      })
    )
  })

  it('does NOT push DLQ when the failure update is zero-match (ownership moved during assembly failure)', async () => {
    mockClassifyStory.mockRejectedValue(new Error('Gemini outage'))
    mockSummary.mockResolvedValue({
      aiSummary: { commonGround: 'CG', leftFraming: 'LF', rightFraming: 'RF' },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })
    mockSpectrum.mockReturnValue([])
    mockBlindspot.mockReturnValue(false)

    const client = createMockClientWithOwnershipMovedStories({
      stories: [
        { id: 'story-1', assembly_claimed_at: null, first_published: '2026-03-22T10:00:00Z' },
      ],
      articles: [
        { id: 'a1', title: 'One', description: 'Desc', source_id: 's1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
        { id: 'a2', title: 'Two', description: 'Desc', source_id: 's2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
      ],
      sources: [
        { id: 's1', bias: 'left', factuality: 'high', ownership: 'corporate' },
        { id: 's2', bias: 'right', factuality: 'high', ownership: 'independent' },
      ],
      takeoverOwner: 'other-owner',
      assemblyRetryCount: 5, // would normally exhaust + DLQ
    })

    const emitter = vi.fn().mockResolvedValue(undefined)
    const result = await assembleStories(client as never, 1, undefined, 'stale-owner', emitter)

    // Phase 10: benign race should produce an empty errors array and
    // zero progress counters — it's invisible to ops. Matches the
    // embeddings.ts pattern where failure-path ownership_moved is a
    // pure benign continue, not a surfaced error.
    expect(result.errors).toEqual([])
    expect(result.storiesProcessed).toBe(0)

    // DLQ insert must NOT have happened for this story.
    expect(client._insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ item_kind: 'story_assemble' })
    )

    // bump_assembly_version RPC must NOT have been called on an ownership move.
    expect(client._rpc).not.toHaveBeenCalledWith(
      'bump_assembly_version',
      expect.anything()
    )

    // Info event for the benign race on the failure phase.
    expect(emitter).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'assemble',
        level: 'info',
        eventType: 'ownership_moved',
        itemId: 'story-1',
        payload: expect.objectContaining({
          phase: 'failure',
          previousOwner: 'stale-owner',
        }),
      })
    )
  })
})
