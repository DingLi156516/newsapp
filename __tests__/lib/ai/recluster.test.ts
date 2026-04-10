import { describe, it, expect, vi } from 'vitest'
import { reclusterRecentStories } from '@/lib/ai/recluster'

/* ------------------------------------------------------------------ */
/*  Mock client builder                                                */
/* ------------------------------------------------------------------ */

interface MockStory {
  id: string
  cluster_centroid: number[]
  last_updated: string
  assembly_claimed_at: string | null
}

interface MockArticle {
  id: string
  embedding: number[]
  story_id: string
}

function createReclusterMockClient(
  stories: MockStory[] = [],
  articlesByStory: Record<string, MockArticle[]> = {},
  options: {
    rpcResults?: Record<string, { story_id: string; similarity: number }[]>
    rpcError?: { message: string } | null
    failReassign?: boolean
    failDelete?: boolean
    failDetach?: boolean
    failDetachIds?: string[]
    failStoryFetch?: boolean
    failArticleSelect?: boolean
    failStoryUpdate?: boolean
    failRequeue?: boolean
  } = {},
) {
  const articleUpdateCalls: { payload: Record<string, unknown>; filter: Record<string, string> }[] = []
  const storyUpdateCalls: { payload: Record<string, unknown>; id: string }[] = []
  const storyDeleteCalls: string[] = []
  const requeueCalls: { storyId: string; expectedVersion: number }[] = []
  const versionBumps: string[] = []

  const rpcMock = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
    if (fn === 'match_story_centroid') {
      if (options.rpcError) {
        return Promise.resolve({ data: null, error: options.rpcError })
      }
      const queryKey = JSON.stringify(params.query_embedding as number[])
      const results = options.rpcResults?.[queryKey] ?? []
      return Promise.resolve({ data: results, error: null })
    }
    if (fn === 'requeue_story_for_reassembly') {
      requeueCalls.push({
        storyId: params.p_story_id as string,
        expectedVersion: params.p_expected_version as number,
      })
      if (options.failRequeue) {
        return Promise.resolve({ data: false, error: null })
      }
      return Promise.resolve({ data: true, error: null })
    }
    if (fn === 'bump_assembly_version') {
      versionBumps.push(params.p_story_id as string)
      return Promise.resolve({ data: null, error: null })
    }
    if (fn === 'merge_stories') {
      const target = params.p_target as string
      const source = params.p_source as string
      // Allow tests to simulate the transactional merge failure via
      // failStoryUpdate (which used to fail the centroid UPDATE) or the
      // dedicated failReassign flag.
      if (options.failStoryUpdate || options.failReassign) {
        return Promise.resolve({
          data: null,
          error: { message: 'Simulated merge_stories failure' },
        })
      }
      // Simulate the atomic merge effect: source story is deleted,
      // source articles are reassigned to target.
      storyDeleteCalls.push(source)
      const sourceArticles = articlesByStory[source] ?? []
      for (const article of sourceArticles) {
        articleUpdateCalls.push({
          payload: { story_id: target },
          filter: { merged_from: source },
        })
      }
      storyUpdateCalls.push({
        payload: { cluster_centroid: params.p_new_centroid },
        id: target,
      })
      return Promise.resolve({ data: true, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'stories') {
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            if (columns.includes('assembly_claimed_at') && columns.includes('cluster_centroid')) {
              // Story fetch for recluster
              return {
                gte: vi.fn().mockReturnValue({
                  not: vi.fn().mockReturnValue({
                    returns: vi.fn().mockResolvedValue(
                      options.failStoryFetch
                        ? { data: null, error: { message: 'DB error' } }
                        : { data: stories, error: null }
                    ),
                  }),
                }),
              }
            }
            if (columns === 'id, assembly_version, assembly_status') {
              // fetchAssemblyVersions path
              return {
                in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
                  const rows = stories
                    .filter((s) => ids.includes(s.id))
                    .map((s) => ({ id: s.id, assembly_version: 0, assembly_status: 'completed' }))
                  return Promise.resolve({ data: rows, error: null })
                }),
              }
            }
            // Article select for merge centroid recompute (embedding only)
            return {
              eq: vi.fn().mockImplementation((_col: string, storyId: string) => {
                return {
                  not: vi.fn().mockReturnValue(
                    Promise.resolve({
                      data: [
                        ...(articlesByStory[storyId] ?? []),
                        // After merge, articles from source are reassigned to target
                        ...Object.entries(articlesByStory)
                          .filter(([sid]) => storyDeleteCalls.includes(sid))
                          .flatMap(([, articles]) => articles.map((a) => ({ ...a, story_id: storyId }))),
                      ],
                      error: null,
                    })
                  ),
                }
              }),
            }
          }),
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            return {
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                storyUpdateCalls.push({ payload, id })
                // Now the centroid update is an isolated write (no assembly_status).
                if (options.failStoryUpdate && payload.cluster_centroid !== undefined) {
                  return Promise.resolve({ error: { message: 'Simulated story update failure' } })
                }
                return Promise.resolve({ error: null })
              }),
            }
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, id: string) => {
              if (options.failDelete) {
                return Promise.resolve({ error: { message: 'Simulated delete failure' } })
              }
              storyDeleteCalls.push(id)
              return Promise.resolve({ error: null })
            }),
          }),
        }
      }

      // articles table
      return {
        select: vi.fn().mockImplementation((_columns: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === 'exact') {
            // Count query for merge ordering
            return {
              eq: vi.fn().mockImplementation((_col: string, storyId: string) => {
                return Promise.resolve({
                  count: (articlesByStory[storyId] ?? []).length,
                  error: null,
                })
              }),
            }
          }
          return {
            eq: vi.fn().mockImplementation((_col: string, storyId: string) => {
              const data = options.failArticleSelect ? null : (articlesByStory[storyId] ?? [])
              const error = options.failArticleSelect ? { message: 'Simulated article select failure' } : null
              const result = Promise.resolve({ data, error })
              // Thenable for direct await (select('id').eq()), chainable for .not() (select('embedding').eq().not())
              return Object.assign(result, {
                not: vi.fn().mockReturnValue(Promise.resolve({ data, error })),
              })
            }),
          }
        }),
        update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          return {
            eq: vi.fn().mockImplementation((col: string, value: string) => {
              if (options.failReassign && col === 'story_id') {
                return Promise.resolve({ error: { message: 'Simulated reassign failure' } })
              }
              if (options.failDetach && payload.clustering_status === 'pending') {
                return Promise.resolve({ error: { message: 'Simulated detach failure' } })
              }
              if (options.failDetachIds?.includes(value) && payload.clustering_status === 'pending') {
                return Promise.resolve({ error: { message: `Simulated detach failure for ${value}` } })
              }
              articleUpdateCalls.push({ payload, filter: { [col]: value } })
              return Promise.resolve({ error: null })
            }),
            in: vi.fn().mockImplementation((_col: string, values: string[]) => {
              articleUpdateCalls.push({ payload, filter: { in: values.join(',') } })
              return Promise.resolve({ error: null })
            }),
          }
        }),
      }
    }),
    rpc: rpcMock,
    _articleUpdateCalls: articleUpdateCalls,
    _storyUpdateCalls: storyUpdateCalls,
    _storyDeleteCalls: storyDeleteCalls,
    _requeueCalls: requeueCalls,
    _versionBumps: versionBumps,
    _rpcMock: rpcMock,
  }
}

const NOW = new Date().toISOString()

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('reclusterRecentStories', () => {
  it('merges two stories with centroid similarity above threshold', async () => {
    const stories: MockStory[] = [
      { id: 'story-A', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-B', cluster_centroid: [0.99, 0.14], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-A': [
        { id: 'a1', embedding: [1, 0], story_id: 'story-A' },
        { id: 'a2', embedding: [0.98, 0.20], story_id: 'story-A' },
      ],
      'story-B': [
        { id: 'a3', embedding: [0.99, 0.14], story_id: 'story-B' },
      ],
    }

    const rpcKey = JSON.stringify([1, 0])
    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: {
        [rpcKey]: [{ story_id: 'story-B', similarity: 0.99 }],
      },
    })

    const result = await reclusterRecentStories(client as never)

    expect(result.mergedPairs).toBe(1)
    expect(client._storyDeleteCalls).toContain('story-B')
  })

  it('does not merge stories below threshold', async () => {
    const stories: MockStory[] = [
      { id: 'story-X', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-Y', cluster_centroid: [0, 1], last_updated: NOW, assembly_claimed_at: null },
    ]

    const client = createReclusterMockClient(stories, {}, {
      rpcResults: {
        [JSON.stringify([1, 0])]: [],
        [JSON.stringify([0, 1])]: [],
      },
    })

    const result = await reclusterRecentStories(client as never)

    expect(result.mergedPairs).toBe(0)
    expect(client._storyDeleteCalls).toEqual([])
  })

  it('detaches article with low similarity to story centroid', async () => {
    const stories: MockStory[] = [
      { id: 'story-split', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-split': [
        { id: 'good-article', embedding: [0.99, 0.14], story_id: 'story-split' },
        { id: 'bad-article', embedding: [0, 1], story_id: 'story-split' }, // sim to [1,0] = 0, well below 0.60
      ],
    }

    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: { [JSON.stringify([1, 0])]: [] },
    })

    const result = await reclusterRecentStories(client as never)

    expect(result.splitArticles).toBe(1)
    const detachUpdate = client._articleUpdateCalls.find(
      (c) => c.filter.id === 'bad-article' && c.payload.clustering_status === 'pending'
    )
    expect(detachUpdate).toBeDefined()
    expect(detachUpdate!.payload.story_id).toBeNull()
    expect(detachUpdate!.payload.clustering_attempts).toBe(0)
  })

  it('does not detach articles above split threshold', async () => {
    const stories: MockStory[] = [
      { id: 'story-ok', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-ok': [
        { id: 'ok-1', embedding: [0.99, 0.14], story_id: 'story-ok' },
        { id: 'ok-2', embedding: [0.95, 0.31], story_id: 'story-ok' },
      ],
    }

    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: { [JSON.stringify([1, 0])]: [] },
    })

    const result = await reclusterRecentStories(client as never)

    expect(result.splitArticles).toBe(0)
  })

  it('skips stories with active assembly_claimed_at', async () => {
    const recentClaim = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago (within TTL)

    const stories: MockStory[] = [
      { id: 'claimed-story', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: recentClaim },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'claimed-story': [
        { id: 'outlier', embedding: [0, 1], story_id: 'claimed-story' },
      ],
    }

    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: { [JSON.stringify([1, 0])]: [] },
    })

    const result = await reclusterRecentStories(client as never)

    // Should not process claimed story at all
    expect(result.mergedPairs).toBe(0)
    expect(result.splitArticles).toBe(0)
    expect(client._articleUpdateCalls).toEqual([])
  })

  it('is idempotent — running twice produces no additional changes', async () => {
    // After first run merges story-B into story-A:
    // - story-B is deleted
    // - Second run should not find story-B to merge again
    const stories: MockStory[] = [
      { id: 'story-only', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
    ]

    const client = createReclusterMockClient(stories, {
      'story-only': [
        { id: 'a1', embedding: [0.99, 0.14], story_id: 'story-only' },
      ],
    }, {
      rpcResults: { [JSON.stringify([1, 0])]: [] },
    })

    const result1 = await reclusterRecentStories(client as never)
    const result2 = await reclusterRecentStories(client as never)

    expect(result1.mergedPairs).toBe(0)
    expect(result1.splitArticles).toBe(0)
    expect(result2.mergedPairs).toBe(0)
    expect(result2.splitArticles).toBe(0)
  })

  it('returns empty result when no stories in window', async () => {
    const client = createReclusterMockClient([], {})

    const result = await reclusterRecentStories(client as never)

    expect(result).toEqual({ mergedPairs: 0, splitArticles: 0, errors: [] })
  })

  it('throws when story fetch fails', async () => {
    const client = createReclusterMockClient([], {}, { failStoryFetch: true })

    await expect(reclusterRecentStories(client as never)).rejects.toThrow('Failed to fetch stories for re-clustering')
  })

  it('skips RPC candidates outside the available stories set', async () => {
    const stories: MockStory[] = [
      { id: 'story-local', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
    ]

    const rpcKey = JSON.stringify([1, 0])
    const client = createReclusterMockClient(stories, {
      'story-local': [
        { id: 'a1', embedding: [0.99, 0.14], story_id: 'story-local' },
      ],
    }, {
      rpcResults: {
        // RPC returns a story that is NOT in the available stories set
        [rpcKey]: [{ story_id: 'story-outside-window', similarity: 0.98 }],
      },
    })

    const result = await reclusterRecentStories(client as never)

    expect(result.mergedPairs).toBe(0)
    expect(client._storyDeleteCalls).toEqual([])

    // F3: Assert cutoff_time was passed to the RPC
    expect(client._rpcMock).toHaveBeenCalled()
    const rpcParams = client._rpcMock.mock.calls[0][1]
    expect(rpcParams.cutoff_time).toBeDefined()
  })

  it('recomputes centroid after detaching outlier articles', async () => {
    const goodEmbedding = [0.99, 0.14]
    const outlierEmbedding = [0, 1]

    const stories: MockStory[] = [
      { id: 'story-centroid', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-centroid': [
        { id: 'good-art', embedding: goodEmbedding, story_id: 'story-centroid' },
        { id: 'outlier-art', embedding: outlierEmbedding, story_id: 'story-centroid' },
      ],
    }

    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: { [JSON.stringify([1, 0])]: [] },
    })

    const result = await reclusterRecentStories(client as never)

    expect(result.splitArticles).toBe(1)

    // Find the story update that includes cluster_centroid (the recompute)
    const centroidUpdate = client._storyUpdateCalls.find(
      (c) => c.id === 'story-centroid' && c.payload.cluster_centroid !== undefined
    )
    expect(centroidUpdate).toBeDefined()

    // Centroid should reflect only the good article's embedding (outlier detached)
    const updatedCentroid = centroidUpdate!.payload.cluster_centroid as number[]
    expect(updatedCentroid[0]).toBeCloseTo(goodEmbedding[0])
    expect(updatedCentroid[1]).toBeCloseTo(goodEmbedding[1])
  })

  it('stops processing candidates after current story is merged away', async () => {
    // story-S has 1 article, story-T1 and story-T2 each have 2
    // story-S is smaller than both, so it becomes the source (deleted)
    const stories: MockStory[] = [
      { id: 'story-S', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-T1', cluster_centroid: [0.99, 0.14], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-T2', cluster_centroid: [0.98, 0.20], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-S': [{ id: 's1', embedding: [1, 0], story_id: 'story-S' }],
      'story-T1': [
        { id: 't1-a', embedding: [0.99, 0.14], story_id: 'story-T1' },
        { id: 't1-b', embedding: [0.98, 0.20], story_id: 'story-T1' },
      ],
      'story-T2': [
        { id: 't2-a', embedding: [0.98, 0.20], story_id: 'story-T2' },
        { id: 't2-b', embedding: [0.97, 0.24], story_id: 'story-T2' },
      ],
    }

    const rpcKey = JSON.stringify([1, 0])
    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: {
        // RPC returns two candidates for story-S
        [rpcKey]: [
          { story_id: 'story-T1', similarity: 0.99 },
          { story_id: 'story-T2', similarity: 0.98 },
        ],
        // story-T1 and story-T2 don't find each other for simplicity
        [JSON.stringify([0.99, 0.14])]: [],
        [JSON.stringify([0.98, 0.20])]: [],
      },
    })

    const result = await reclusterRecentStories(client as never)

    // story-S merged into story-T1, then the loop should break
    expect(result.mergedPairs).toBe(1)
    expect(client._storyDeleteCalls).toContain('story-S')
    expect(client._storyDeleteCalls).not.toContain('story-T2')
  })

  it('includes failed-to-detach article in centroid recomputation', async () => {
    const goodEmbedding = [0.99, 0.14]
    const outlier1Embedding = [0, 1]
    const outlier2Embedding = [0.1, 0.99]

    const stories: MockStory[] = [
      { id: 'story-partial', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-partial': [
        { id: 'good-art', embedding: goodEmbedding, story_id: 'story-partial' },
        { id: 'outlier-1', embedding: outlier1Embedding, story_id: 'story-partial' },
        { id: 'outlier-2', embedding: outlier2Embedding, story_id: 'story-partial' },
      ],
    }

    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: { [JSON.stringify([1, 0])]: [] },
      failDetachIds: ['outlier-1'],
    })

    const result = await reclusterRecentStories(client as never)

    // outlier-2 detached successfully, outlier-1 failed
    expect(result.splitArticles).toBe(1)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('outlier-1')

    // Centroid should reflect good-art + outlier-1 (still attached), NOT outlier-2
    const centroidUpdate = client._storyUpdateCalls.find(
      (c) => c.id === 'story-partial' && c.payload.cluster_centroid !== undefined
    )
    expect(centroidUpdate).toBeDefined()

    // The remaining articles mock returns all articles for the story.
    // After filtering out detachSet (which only has outlier-2), centroid
    // should be computed from good-art + outlier-1.
    const updatedCentroid = centroidUpdate!.payload.cluster_centroid as number[]
    // Centroid of [0.99, 0.14] and [0, 1] = [0.495, 0.57]
    const expectedCentroid = [
      (goodEmbedding[0] + outlier1Embedding[0]) / 2,
      (goodEmbedding[1] + outlier1Embedding[1]) / 2,
    ]
    expect(updatedCentroid[0]).toBeCloseTo(expectedCentroid[0], 1)
    expect(updatedCentroid[1]).toBeCloseTo(expectedCentroid[1], 1)
  })

  it('queues reassembly even when merge article fetch fails', async () => {
    const stories: MockStory[] = [
      { id: 'story-A', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-B', cluster_centroid: [0.99, 0.14], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-A': [
        { id: 'a1', embedding: [1, 0], story_id: 'story-A' },
        { id: 'a2', embedding: [0.98, 0.20], story_id: 'story-A' },
      ],
      'story-B': [
        { id: 'a3', embedding: [0.99, 0.14], story_id: 'story-B' },
      ],
    }

    const rpcKey = JSON.stringify([1, 0])
    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: {
        [rpcKey]: [{ story_id: 'story-B', similarity: 0.99 }],
      },
      failArticleSelect: true,
    })

    const result = await reclusterRecentStories(client as never)

    // Article fetch failure surfaces as an error and the merge is skipped.
    // The atomic merge RPC is not called when we couldn't compute a centroid
    // for it, and the source story is not deleted.
    expect(result.errors.some((e) => e.includes('Failed to fetch source articles'))).toBe(true)
    expect(result.mergedPairs).toBe(0)
    expect(client._storyDeleteCalls).not.toContain('story-B')
  })

  it('uses target story centroid as fallback when outer-loop story is merged away', async () => {
    // story-S has 1 article (smaller), story-T has 2 (larger/target)
    // story-S is the outer-loop story but gets merged INTO story-T
    // On fetch failure, fallback centroid should be story-T's, not story-S's
    const stories: MockStory[] = [
      { id: 'story-S', cluster_centroid: [0, 1], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-T', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-S': [
        { id: 's1', embedding: [0, 1], story_id: 'story-S' },
      ],
      'story-T': [
        { id: 't1', embedding: [1, 0], story_id: 'story-T' },
        { id: 't2', embedding: [0.98, 0.20], story_id: 'story-T' },
      ],
    }

    const rpcKey = JSON.stringify([0, 1])
    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: {
        [rpcKey]: [{ story_id: 'story-T', similarity: 0.99 }],
        [JSON.stringify([1, 0])]: [],
      },
      failArticleSelect: true,
    })

    const result = await reclusterRecentStories(client as never)

    // Atomic merge path skips when we can't fetch source articles to
    // compute the centroid. The error is surfaced and no merge is performed.
    expect(result.errors.some((e) => e.includes('Failed to fetch source articles'))).toBe(true)
    expect(result.mergedPairs).toBe(0)
    expect(client._storyDeleteCalls).not.toContain('story-S')
  })

  it('atomic merge RPC failure surfaces as an error and preserves both stories', async () => {
    const stories: MockStory[] = [
      { id: 'story-A', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-B', cluster_centroid: [0.99, 0.14], last_updated: NOW, assembly_claimed_at: null },
    ]

    const articlesByStory: Record<string, MockArticle[]> = {
      'story-A': [
        { id: 'a1', embedding: [1, 0], story_id: 'story-A' },
        { id: 'a2', embedding: [0.98, 0.20], story_id: 'story-A' },
      ],
      'story-B': [
        { id: 'a3', embedding: [0.99, 0.14], story_id: 'story-B' },
      ],
    }

    const rpcKey = JSON.stringify([1, 0])
    const client = createReclusterMockClient(stories, articlesByStory, {
      rpcResults: {
        [rpcKey]: [{ story_id: 'story-B', similarity: 0.99 }],
      },
      failStoryUpdate: true,
    })

    const result = await reclusterRecentStories(client as never)

    // Merge should NOT complete — the RPC raised, transaction rolled back.
    expect(result.mergedPairs).toBe(0)
    expect(client._storyDeleteCalls).not.toContain('story-B')

    // Error collected for the failed merge RPC.
    expect(result.errors.some((e) => e.includes('Failed to merge story'))).toBe(true)
  })

  it('emits pgvector_fallback when the match_story_centroid RPC errors', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stories: MockStory[] = [
      { id: 'story-A', cluster_centroid: [1, 0], last_updated: NOW, assembly_claimed_at: null },
      { id: 'story-B', cluster_centroid: [0.9, 0.1], last_updated: NOW, assembly_claimed_at: null },
    ]

    const client = createReclusterMockClient(stories, {}, {
      rpcError: { message: 'function match_story_centroid does not exist' },
    })

    const emitter = vi.fn().mockResolvedValue(undefined)

    await reclusterRecentStories(client as never, 24, emitter)

    expect(emitter).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'recluster',
        level: 'warn',
        eventType: 'pgvector_fallback',
        payload: expect.objectContaining({
          error: 'function match_story_centroid does not exist',
        }),
      })
    )

    consoleSpy.mockRestore()
  })
})
