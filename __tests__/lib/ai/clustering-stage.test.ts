import { describe, it, expect, vi } from 'vitest'
import {
  clusterArticles,
} from '@/lib/ai/clustering'

/**
 * Build a mock Supabase client that simulates the chained query API.
 *
 * `articleRows` controls what the articles SELECT returns.
 * `storyRows` controls what the stories SELECT returns.
 * The mock tracks all update/insert calls for assertions.
 */
function createMockClient(
  articleRows: Record<string, unknown>[] = [],
  storyRows: Record<string, unknown>[] = [],
  options: {
    failSingletonUpdate?: boolean
    failInitialClaimIds?: string[]
    failStoryFetch?: boolean
    rpcResults?: Record<string, unknown>[] | null
    rpcError?: { message: string } | null
  } = {},
) {
  const articleUpdateCalls: { payload: Record<string, unknown>; id: string }[] = []

  // Article select chain for fetching unassigned articles
  // Chain: .select().eq('is_embedded').is('story_id').eq('clustering_status').order().order().limit().returns()
  const articleReturns = vi.fn().mockResolvedValue({
    data: articleRows,
    error: null,
  })
  const articleLimit = vi.fn().mockReturnValue({ returns: articleReturns })
  const articleOrder2 = vi.fn().mockReturnValue({ limit: articleLimit })
  const articleOrder = vi.fn().mockReturnValue({ order: articleOrder2 })
  const articleEqClusteringStatus = vi.fn().mockReturnValue({ order: articleOrder })
  const articleIs = vi.fn().mockReturnValue({ eq: articleEqClusteringStatus })
  const articleEq = vi.fn().mockReturnValue({ is: articleIs })
  const articleSelect = vi.fn().mockReturnValue({ eq: articleEq })

  // Story insert chain
  const storySingle = vi.fn().mockResolvedValue({ data: { id: 'story-1' }, error: null })
  const storySelectAfterInsert = vi.fn().mockReturnValue({ single: storySingle })
  const storyInsert = vi.fn().mockReturnValue({ select: storySelectAfterInsert })

  // Story select chain for fetching existing stories
  const storyReturns = vi.fn().mockResolvedValue(
    options.failStoryFetch
      ? { data: null, error: { message: 'DB error' } }
      : { data: storyRows, error: null }
  )
  const storyNot = vi.fn().mockReturnValue({ returns: storyReturns })
  const storyGte = vi.fn().mockReturnValue({ not: storyNot })
  const storySelect = vi.fn((columns?: string) => {
    if (columns === 'id, cluster_centroid, last_updated') {
      return { gte: storyGte }
    }
    return { insert: storyInsert }
  })

  // Track story deletions
  const storyDeleteCalls: string[] = []
  const storyDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockImplementation((_col: string, id: string) => {
      storyDeleteCalls.push(id)
      return Promise.resolve({ error: null })
    }),
  })

  // RPC mock for match_story_centroid
  const rpcCalls: { fn: string; params: Record<string, unknown> }[] = []
  const rpcMock = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
    rpcCalls.push({ fn, params })
    if (options.rpcError) {
      return Promise.resolve({ data: null, error: options.rpcError })
    }
    return Promise.resolve({ data: options.rpcResults ?? [], error: null })
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'articles') {
        return {
          select: articleSelect,
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            return {
              in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
                if (payload.clustering_claimed_at) {
                  const shouldFail = ids.some((id) => options.failInitialClaimIds?.includes(id))
                  if (shouldFail) {
                    return Promise.resolve({ error: { message: 'Simulated initial claim failure' } })
                  }
                }
                if (options.failSingletonUpdate && payload.clustering_status === 'clustered') {
                  return Promise.resolve({ error: { message: 'Simulated update failure' } })
                }
                ids.forEach((id) => articleUpdateCalls.push({ payload, id }))
                return Promise.resolve({ error: null })
              }),
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                articleUpdateCalls.push({ payload, id })
                if (options.failSingletonUpdate && payload.clustering_status === 'clustered') {
                  return Promise.resolve({ error: { message: 'Simulated update failure' } })
                }
                return Promise.resolve({ error: null })
              }),
            }
          }),
        }
      }
      return {
        select: storySelect,
        insert: storyInsert,
        delete: storyDelete,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }),
    rpc: rpcMock,
    _storyInsert: storyInsert,
    _storyDeleteCalls: storyDeleteCalls,
    _articleUpdateCalls: articleUpdateCalls,
    _storySingle: storySingle,
    _rpcCalls: rpcCalls,
  }
}

const TWO_SIMILAR_ARTICLES = [
  {
    id: 'a1',
    title: 'Story one',
    source_id: 's1',
    embedding: [1, 0],
    published_at: '2026-03-01T00:00:00Z',
    created_at: '2026-03-01T00:00:00Z',
    story_id: null,
    image_url: 'img.jpg',
    clustering_claimed_at: null,
    clustering_attempts: 0,
  },
  {
    id: 'a2',
    title: 'Story two',
    source_id: 's2',
    embedding: [0.99, 0.01],
    published_at: '2026-03-01T02:00:00Z',
    created_at: '2026-03-01T02:00:00Z',
    story_id: null,
    image_url: null,
    clustering_claimed_at: '2026-03-22T11:20:00Z',
    clustering_attempts: 0,
  },
]

describe('clusterArticles', () => {
  it('creates draft stories with explicit processing state and earliest publish time', async () => {
    const client = createMockClient([
      ...TWO_SIMILAR_ARTICLES,
      {
        id: 'a3',
        title: 'Freshly claimed',
        source_id: 's3',
        embedding: [0.98, 0.02],
        published_at: '2026-03-01T03:00:00Z',
        created_at: '2026-03-01T03:00:00Z',
        story_id: null,
        image_url: null,
        clustering_claimed_at: '2026-03-22T11:50:00Z',
        clustering_attempts: 0,
      },
    ])

    const result = await clusterArticles(client as never)

    expect(result.newStories).toBe(1)
    expect(client._storyInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Pending headline generation',
        assembly_status: 'pending',
        publication_status: 'draft',
        review_status: 'pending',
        review_reasons: [],
        first_published: '2026-03-01T00:00:00Z',
      })
    )
  })

  it('skips freshly claimed articles and clears clustering claims on assignment', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'))

    const client = createMockClient([
      ...TWO_SIMILAR_ARTICLES,
      {
        id: 'a3',
        title: 'Freshly claimed',
        source_id: 's3',
        embedding: [0.98, 0.02],
        published_at: '2026-03-01T03:00:00Z',
        created_at: '2026-03-01T03:00:00Z',
        story_id: null,
        image_url: null,
        clustering_claimed_at: '2026-03-22T11:50:00Z',
        clustering_attempts: 0,
      },
    ])

    const result = await clusterArticles(client as never)

    expect(result.assignedArticles).toBe(2)
    expect(client._storyInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_count: 0,
      })
    )

    vi.useRealTimers()
  })

  it('promotes singleton after 3 failed clustering attempts', async () => {
    const client = createMockClient([
      {
        id: 'singleton-1',
        title: 'Lonely article',
        source_id: 's1',
        embedding: [1, 0],
        published_at: '2026-03-15T00:00:00Z',
        created_at: '2026-03-15T00:00:00Z',
        story_id: null,
        image_url: 'singleton.jpg',
        clustering_claimed_at: null,
        clustering_attempts: 2,
      },
    ])

    const result = await clusterArticles(client as never)

    expect(result.promotedSingletons).toBe(1)
    expect(result.newStories).toBe(1)
    expect(result.assignedArticles).toBe(1)
    expect(result.unmatchedSingletons).toBe(0)

    // Should have created a story
    expect(client._storyInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Pending headline generation',
        story_kind: 'standard',
        assembly_status: 'pending',
        publication_status: 'draft',
        first_published: '2026-03-15T00:00:00Z',
      })
    )

    // Should have updated the article with clustered status
    const promotionUpdate = client._articleUpdateCalls.find(
      c => c.id === 'singleton-1' && c.payload.clustering_status === 'clustered'
    )
    expect(promotionUpdate).toBeDefined()
    expect(promotionUpdate!.payload.clustering_attempts).toBe(3)
    expect(promotionUpdate!.payload.story_id).toBe('story-1')
  })

  it('increments clustering_attempts and releases singleton with < 3 attempts', async () => {
    const client = createMockClient([
      {
        id: 'retry-1',
        title: 'Will retry later',
        source_id: 's1',
        embedding: [1, 0],
        published_at: '2026-03-15T00:00:00Z',
        created_at: '2026-03-15T00:00:00Z',
        story_id: null,
        image_url: null,
        clustering_claimed_at: null,
        clustering_attempts: 0,
      },
    ])

    const result = await clusterArticles(client as never)

    expect(result.unmatchedSingletons).toBe(1)
    expect(result.promotedSingletons).toBe(0)
    expect(result.newStories).toBe(0)

    // Should have incremented attempts and cleared claim
    const incrementUpdate = client._articleUpdateCalls.find(
      c => c.id === 'retry-1' && c.payload.clustering_attempts === 1
    )
    expect(incrementUpdate).toBeDefined()
    expect(incrementUpdate!.payload.clustering_claimed_at).toBeNull()
  })

  it('sets clustering_status to clustered when assigning articles to stories', async () => {
    const client = createMockClient(TWO_SIMILAR_ARTICLES)

    const result = await clusterArticles(client as never)

    expect(result.assignedArticles).toBe(2)

    // Both assigned articles should have clustering_status: 'clustered'
    const clusteredUpdates = client._articleUpdateCalls.filter(
      c => c.payload.clustering_status === 'clustered' && c.payload.story_id != null
    )
    expect(clusteredUpdates.length).toBe(2)
  })

  it('runs expiry sweep even when no articles to process', async () => {
    const client = createMockClient([])

    const result = await clusterArticles(client as never)

    expect(result.expiredArticles).toBe(0)
  })

  it('handles article-update failure after singleton promotion story insert', async () => {
    const client = createMockClient(
      [
        {
          id: 'singleton-fail',
          title: 'Lonely article',
          source_id: 's1',
          embedding: [1, 0],
          published_at: '2026-03-15T00:00:00Z',
          created_at: '2026-03-15T00:00:00Z',
          story_id: null,
          image_url: null,
          clustering_claimed_at: null,
          clustering_attempts: 2,
        },
      ],
      [],
      { failSingletonUpdate: true },
    )

    const result = await clusterArticles(client as never)

    expect(result.promotedSingletons).toBe(0)
    expect(result.assignedArticles).toBe(0)
    expect(result.newStories).toBe(0)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]).toContain('Failed to assign promoted singleton singleton-fail')

    // Should have deleted the orphan story
    expect(client._storyDeleteCalls).toEqual(['story-1'])
  })

  it('does not process articles whose initial claim update failed', async () => {
    const client = createMockClient(
      [
        {
          ...TWO_SIMILAR_ARTICLES[0],
          id: 'failed-claim',
        },
        {
          ...TWO_SIMILAR_ARTICLES[1],
          id: 'claimed-ok',
          clustering_claimed_at: null,
        },
      ],
      [],
      { failInitialClaimIds: ['failed-claim'] },
    )

    const result = await clusterArticles(client as never)

    expect(result.assignedArticles).toBe(0)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('claim'),
      ]),
    )
  })

  it('releases claims in finally block if processing throws an error', async () => {
    const articles = TWO_SIMILAR_ARTICLES
    const client = createMockClient(articles, [], { failStoryFetch: true })

    await expect(clusterArticles(client as never)).rejects.toThrow('Failed to fetch existing stories: DB error')

    // The finally block should have fired a release update
    const releaseUpdates = client._articleUpdateCalls.filter(c => c.payload.clustering_claimed_at === null)
    expect(releaseUpdates.length).toBe(articles.length)
  })

  it('matches articles to existing stories via pgvector RPC', async () => {
    const article = {
      id: 'rpc-match-1',
      title: 'Article for RPC matching',
      source_id: 's1',
      embedding: [1, 0],
      published_at: '2026-03-01T00:00:00Z',
      created_at: '2026-03-01T00:00:00Z',
      story_id: null,
      image_url: null,
      clustering_claimed_at: null,
      clustering_attempts: 0,
    }

    const existingStory = {
      id: 'existing-story-rpc',
      cluster_centroid: [0.99, 0.01],
      last_updated: new Date().toISOString(),
    }

    const client = createMockClient(
      [article],
      [existingStory],
      {
        rpcResults: [{ story_id: 'existing-story-rpc', similarity: 0.99 }],
      },
    )

    const result = await clusterArticles(client as never)

    expect(result.assignedArticles).toBe(1)
    expect(result.newStories).toBe(0)
    // RPC should have been called for match_story_centroid
    expect(client._rpcCalls.length).toBeGreaterThan(0)
    expect(client._rpcCalls[0].fn).toBe('match_story_centroid')
  })

  it('falls back to JS brute-force when RPC fails without errors', async () => {
    const client = createMockClient(
      TWO_SIMILAR_ARTICLES,
      [],
      { rpcError: { message: 'function match_story_centroid does not exist' } },
    )

    const result = await clusterArticles(client as never)

    // Should still cluster successfully via JS fallback
    expect(result.assignedArticles).toBe(2)
    expect(result.newStories).toBe(1)
    expect(result.errors.length).toBe(0)
  })
})
