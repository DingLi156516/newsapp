import { describe, it, expect, vi } from 'vitest'
import {
  clusterArticles,
} from '@/lib/ai/clustering'

const CLAIM_TTL_MS = 30 * 60 * 1000

/**
 * Build a mock Supabase client that simulates the atomic-claim clustering API.
 *
 * `articleRows` controls what the claim RPC + subsequent fetch return.
 * `storyRows` controls what the stories SELECT returns.
 * The mock tracks update/insert/release calls for assertions.
 */
function createMockClient(
  articleRows: Record<string, unknown>[] = [],
  storyRows: Record<string, unknown>[] = [],
  options: {
    failSingletonUpdate?: boolean
    skipClaimIds?: string[]
    failStoryFetch?: boolean
    rpcResults?: Record<string, unknown>[] | null
    rpcError?: { message: string } | null
  } = {},
) {
  const articleUpdateCalls: { payload: Record<string, unknown>; id: string }[] = []
  const releasedClaims: string[] = []

  // --- Article fetch by claimed IDs: select(...).in('id', ids) ---
  const fetchArticlesByIds = vi.fn((_col: string, ids: string[]) => {
    const bySet = new Set(ids)
    const matching = (articleRows as Record<string, unknown>[]).filter(
      (a) => bySet.has(a.id as string)
    )
    return Promise.resolve({ data: matching, error: null })
  })
  const articleSelect = vi.fn().mockReturnValue({ in: fetchArticlesByIds })

  // --- Story insert: the RPC now handles this atomically, so the mock
  //     simply records the payloads that would have been inserted. We
  //     expose a spy on the RPC path so existing `_storyInsert` assertions
  //     still work unchanged.
  const storyInsert = vi.fn()

  // --- Story fetch chain for existing stories used in clustering ---
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

  // --- Story deletions tracker ---
  const storyDeleteCalls: string[] = []
  const storyDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockImplementation((_col: string, id: string) => {
      storyDeleteCalls.push(id)
      return Promise.resolve({ error: null })
    }),
  })

  // --- RPC mock: claim/release + create_story_with_articles + match_story_centroid ---
  const rpcCalls: { fn: string; params: Record<string, unknown> }[] = []
  let nextStoryIdCounter = 1
  const storyCreatePayloads: Array<{ payload: Record<string, unknown>; articleIds: string[] }> = []
  const rpcMock = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
    rpcCalls.push({ fn, params })
    if (fn === 'claim_articles_for_clustering') {
      const now = Date.now()
      const skipSet = new Set(options.skipClaimIds ?? [])
      const claimable = articleRows.filter((row) => {
        if (skipSet.has(row.id as string)) return false
        const claimedAt = (row.clustering_claimed_at as string | null | undefined) ?? null
        if (!claimedAt) return true
        const claimedMs = new Date(claimedAt).getTime()
        return Number.isNaN(claimedMs) || now - claimedMs >= CLAIM_TTL_MS
      })
      const limit = (params.p_limit as number | undefined) ?? claimable.length
      return Promise.resolve({
        data: claimable.slice(0, limit).map((a) => a.id as string),
        error: null,
      })
    }
    if (fn === 'release_clustering_claim') {
      releasedClaims.push(params.p_article_id as string)
      return Promise.resolve({ data: true, error: null })
    }
    if (fn === 'create_story_with_articles') {
      const articleIds = params.p_article_ids as string[]
      // Record for legacy `_storyInsert` assertions.
      storyInsert(params.p_story)
      if (options.failSingletonUpdate) {
        // Simulate an atomic rollback: no story is created and no
        // articles are touched — the RPC raises and rolls back.
        return Promise.resolve({
          data: null,
          error: { message: 'Simulated transactional failure' },
        })
      }
      const newStoryId = `story-${nextStoryIdCounter}`
      nextStoryIdCounter += 1
      storyCreatePayloads.push({
        payload: params.p_story as Record<string, unknown>,
        articleIds: [...articleIds],
      })
      return Promise.resolve({ data: newStoryId, error: null })
    }
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
    _releasedClaims: releasedClaims,
    _storyCreatePayloads: storyCreatePayloads,
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

    // The transactional RPC assigned the article to the new story.
    const creation = client._storyCreatePayloads.find(
      (c) => c.articleIds.includes('singleton-1')
    )
    expect(creation).toBeDefined()

    // A follow-up UPDATE bumps clustering_attempts to 3 (the retry budget).
    const attemptsUpdate = client._articleUpdateCalls.find(
      (c) => c.id === 'singleton-1' && c.payload.clustering_attempts === 3
    )
    expect(attemptsUpdate).toBeDefined()
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

  it('assigns clustered articles to a new story atomically via the RPC', async () => {
    const client = createMockClient(TWO_SIMILAR_ARTICLES)

    const result = await clusterArticles(client as never)

    expect(result.assignedArticles).toBe(2)

    // Both assigned articles should appear in the atomic create_story_with_articles payload.
    const creation = client._storyCreatePayloads.find(
      (c) => c.articleIds.length === 2
    )
    expect(creation).toBeDefined()
    expect(creation!.articleIds).toEqual(expect.arrayContaining(['a1', 'a2']))
  })

  it('runs expiry sweep even when no articles to process', async () => {
    const client = createMockClient([])

    const result = await clusterArticles(client as never)

    expect(result.expiredArticles).toBe(0)
  })

  it('rolls back atomically when singleton promotion RPC fails', async () => {
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
    expect(result.errors[0]).toContain('Failed to promote singleton singleton-fail')

    // The RPC transactional rollback means no story was ever inserted — so
    // no compensating delete is required. The old "_storyDeleteCalls" check
    // does not apply here anymore.
    expect(client._storyDeleteCalls).toEqual([])
  })

  it('does not process articles that the atomic claim RPC skipped', async () => {
    // The claim RPC is atomic: if another runner owns a row, it is simply
    // absent from the returned ID list. There is no per-article "failed
    // claim" path anymore — the runner works on whatever IDs it receives.
    const client = createMockClient(
      [
        { ...TWO_SIMILAR_ARTICLES[0], id: 'skipped-by-rpc', clustering_claimed_at: null },
      ],
      [],
      { skipClaimIds: ['skipped-by-rpc'] },
    )

    const result = await clusterArticles(client as never)

    expect(result.assignedArticles).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('releases claims via release RPC if processing throws an error', async () => {
    const articles = TWO_SIMILAR_ARTICLES
    const client = createMockClient(articles, [], { failStoryFetch: true })

    await expect(clusterArticles(client as never)).rejects.toThrow('Failed to fetch existing stories: DB error')

    // The finally block releases every claim via the owner-scoped RPC.
    expect(client._releasedClaims.length).toBe(articles.length)
    for (const article of articles) {
      expect(client._releasedClaims).toContain(article.id)
    }
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
    // match_story_centroid should have been called during Pass 1 (after the
    // atomic claim RPC).
    expect(client._rpcCalls.some((c) => c.fn === 'match_story_centroid')).toBe(true)
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
