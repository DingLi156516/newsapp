import { cosineSimilarity, computeCentroid, clusterUnmatchedArticles, interleaveBySource, matchArticleViaJs, parseVector, recomputeStoryCentroid, SIMILARITY_THRESHOLD, SPLIT_THRESHOLD } from '@/lib/ai/clustering'
import type { ClusterableArticle } from '@/lib/ai/clustering'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0]
    const b = [0, 1]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0]
    const b = [-1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0)
  })

  it('returns 0 for zero vectors', () => {
    const a = [0, 0, 0]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('computes correct similarity for general vectors', () => {
    const a = [1, 2, 3]
    const b = [4, 5, 6]
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77))
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected)
  })
})

describe('computeCentroid', () => {
  it('returns empty array for empty input', () => {
    expect(computeCentroid([])).toEqual([])
  })

  it('returns the vector itself for single input', () => {
    expect(computeCentroid([[1, 2, 3]])).toEqual([1, 2, 3])
  })

  it('computes element-wise average', () => {
    const vectors = [
      [2, 4, 6],
      [4, 6, 8],
    ]
    expect(computeCentroid(vectors)).toEqual([3, 5, 7])
  })

  it('handles three vectors correctly', () => {
    const vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]
    const result = computeCentroid(vectors)
    expect(result[0]).toBeCloseTo(1 / 3)
    expect(result[1]).toBeCloseTo(1 / 3)
    expect(result[2]).toBeCloseTo(1 / 3)
  })
})

/* ------------------------------------------------------------------ */
/*  clusterUnmatchedArticles — union-find score-ranked clustering      */
/* ------------------------------------------------------------------ */

function makeArticle(id: string, embedding: number[]): ClusterableArticle {
  return { id, embedding, image_url: null }
}

/** Normalize cluster output for comparison: sort article IDs within each cluster, sort clusters by first ID. */
function normalizeClusters(clusters: { articleIds: string[] }[]): string[][] {
  return clusters
    .map((c) => [...c.articleIds].sort())
    .sort((a, b) => a[0].localeCompare(b[0]))
}

describe('clusterUnmatchedArticles', () => {
  it('produces identical clusters regardless of input order', () => {
    // Two natural clusters: group1 = {a1, a2, a3}, group2 = {a4, a5}
    // Group 1 embeddings: nearly parallel vectors
    const g1a = [1, 0]
    const g1b = [0.99, 0.14]    // sim to g1a ≈ 0.990
    const g1c = [0.98, 0.20]    // sim to g1a ≈ 0.980
    // Group 2 embeddings: nearly parallel, orthogonal to group 1
    const g2a = [0, 1]
    const g2b = [0.14, 0.99]    // sim to g2a ≈ 0.990

    const articles = [
      makeArticle('a1', g1a),
      makeArticle('a2', g1b),
      makeArticle('a3', g1c),
      makeArticle('a4', g2a),
      makeArticle('a5', g2b),
    ]

    const perm1 = [articles[0], articles[1], articles[2], articles[3], articles[4]]
    const perm2 = [articles[4], articles[2], articles[0], articles[3], articles[1]]
    const perm3 = [articles[3], articles[1], articles[4], articles[0], articles[2]]

    const result1 = normalizeClusters(clusterUnmatchedArticles(perm1, 0.72))
    const result2 = normalizeClusters(clusterUnmatchedArticles(perm2, 0.72))
    const result3 = normalizeClusters(clusterUnmatchedArticles(perm3, 0.72))

    expect(result1).toEqual([['a1', 'a2', 'a3'], ['a4', 'a5']])
    expect(result2).toEqual(result1)
    expect(result3).toEqual(result1)
  })

  it('ejects outliers connected only via transitive chaining', () => {
    // Core: a1, a2 (very similar) — bridge: b (connected to core + outlier) — outlier: c
    // a1=[1,0], a2=[0.999,0.045], b=[0.80,0.60], c=[0.174,0.985]
    // a1~a2 ≈ 0.999, a1~b = 0.80, a2~b ≈ 0.827, b~c ≈ 0.730
    // a1~c ≈ 0.174, a2~c ≈ 0.218  (both below 0.72)
    // Union-find merges all 4, but centroid validation ejects c (sim ≈ 0.627)
    const articles = [
      makeArticle('a1', [1, 0]),
      makeArticle('a2', [0.999, 0.045]),
      makeArticle('b', [0.80, 0.60]),
      makeArticle('c', [0.174, 0.985]),
    ]

    const clusters = normalizeClusters(clusterUnmatchedArticles(articles, 0.72))

    // Core + bridge stay together; outlier is ejected to singleton
    expect(clusters).toEqual([['a1', 'a2', 'b'], ['c']])
  })

  it('returns all singletons when no pairs exceed threshold', () => {
    // Orthogonal vectors: all pairwise similarities ≈ 0
    const articles = [
      makeArticle('x', [1, 0, 0]),
      makeArticle('y', [0, 1, 0]),
      makeArticle('z', [0, 0, 1]),
    ]

    const clusters = normalizeClusters(clusterUnmatchedArticles(articles, 0.72))

    expect(clusters).toEqual([['x'], ['y'], ['z']])
  })

  it('merges all articles into one cluster when all pairs exceed threshold', () => {
    // Nearly identical vectors
    const articles = [
      makeArticle('p', [1, 0]),
      makeArticle('q', [0.99, 0.14]),
      makeArticle('r', [0.98, 0.20]),
    ]

    const clusters = normalizeClusters(clusterUnmatchedArticles(articles, 0.72))

    expect(clusters).toEqual([['p', 'q', 'r']])
  })

  it('returns empty array for empty input', () => {
    expect(clusterUnmatchedArticles([], 0.72)).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/*  interleaveBySource — round-robin source diversity                  */
/* ------------------------------------------------------------------ */

function makeInterleavedArticle(id: string, sourceId: string) {
  return {
    id,
    title: id,
    source_id: sourceId,
    embedding: [1, 0],
    published_at: '2026-04-07T00:00:00Z',
    created_at: '2026-04-07T00:00:00Z',
    story_id: null,
    image_url: null,
    clustering_claimed_at: null,
    clustering_attempts: 0,
  }
}

describe('interleaveBySource', () => {
  it('round-robins articles from different sources', () => {
    const articles = [
      makeInterleavedArticle('a1', 'src-a'),
      makeInterleavedArticle('a2', 'src-a'),
      makeInterleavedArticle('a3', 'src-a'),
      makeInterleavedArticle('b1', 'src-b'),
      makeInterleavedArticle('c1', 'src-c'),
    ]

    const result = interleaveBySource(articles)
    const ids = result.map((a) => a.id)

    // First round: one from each source
    expect(ids[0]).toBe('a1')
    expect(ids[1]).toBe('b1')
    expect(ids[2]).toBe('c1')
    // Second round: only src-a has remaining
    expect(ids[3]).toBe('a2')
    // Third round
    expect(ids[4]).toBe('a3')
  })

  it('returns empty array for empty input', () => {
    expect(interleaveBySource([])).toEqual([])
  })

  it('returns same array for single-source input', () => {
    const articles = [
      makeInterleavedArticle('a1', 'src-a'),
      makeInterleavedArticle('a2', 'src-a'),
    ]

    const result = interleaveBySource(articles)

    expect(result.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('preserves all articles without duplication', () => {
    const articles = [
      makeInterleavedArticle('a1', 'src-a'),
      makeInterleavedArticle('a2', 'src-a'),
      makeInterleavedArticle('b1', 'src-b'),
      makeInterleavedArticle('b2', 'src-b'),
      makeInterleavedArticle('c1', 'src-c'),
    ]

    const result = interleaveBySource(articles)

    expect(result).toHaveLength(5)
    const ids = new Set(result.map((a) => a.id))
    expect(ids.size).toBe(5)
  })
})

/* ------------------------------------------------------------------ */
/*  parseVector                                                        */
/* ------------------------------------------------------------------ */

describe('parseVector', () => {
  it('returns array input unchanged', () => {
    const v = [1, 2, 3]
    expect(parseVector(v)).toBe(v)
  })

  it('parses JSON string to number array', () => {
    expect(parseVector('[1,2,3]')).toEqual([1, 2, 3])
  })
})

/* ------------------------------------------------------------------ */
/*  Constants — env-configurable defaults                              */
/* ------------------------------------------------------------------ */

describe('clustering constants', () => {
  it('exports SIMILARITY_THRESHOLD with expected default', () => {
    // Default was lowered from 0.72 to 0.70 for better cross-source matching
    expect(SIMILARITY_THRESHOLD).toBe(0.70)
  })

  it('exports SPLIT_THRESHOLD with expected default', () => {
    expect(SPLIT_THRESHOLD).toBe(0.60)
  })
})

/* ------------------------------------------------------------------ */
/*  Centroid recomputation after Pass 1 — behavioral validation        */
/* ------------------------------------------------------------------ */

describe('centroid recomputation (behavioral)', () => {
  it('computeCentroid correctly updates when new articles are added to a story', () => {
    // Simulates the centroid recomputation that happens in persistPass1Assignments.
    // Initial story centroid: single article embedding
    const initialEmbedding = [1.0, 0.0, 0.0]
    const initialCentroid = computeCentroid([initialEmbedding])
    expect(initialCentroid).toEqual([1.0, 0.0, 0.0])

    // After Pass 1 assigns a new article, we recompute from all embeddings
    const newArticleEmbedding = [0.8, 0.6, 0.0]
    const recomputedCentroid = computeCentroid([initialEmbedding, newArticleEmbedding])

    // The centroid should shift to incorporate the new article
    expect(recomputedCentroid[0]).toBeCloseTo(0.9)
    expect(recomputedCentroid[1]).toBeCloseTo(0.3)
    expect(recomputedCentroid[2]).toBeCloseTo(0.0)

    // The recomputed centroid should be more similar to the new article
    // than the original singleton centroid was
    const simWithOldCentroid = cosineSimilarity(newArticleEmbedding, initialCentroid)
    const simWithNewCentroid = cosineSimilarity(newArticleEmbedding, recomputedCentroid)
    expect(simWithNewCentroid).toBeGreaterThan(simWithOldCentroid)
  })

  it('centroid drift worsens matching when not recomputed (baseline)', () => {
    // Story starts as singleton: embedding pointing strongly in x
    const article1 = [1.0, 0.0]
    // Second article joins via Pass 1: slightly different angle
    const article2 = [0.9, 0.44]

    const stalecentroid = computeCentroid([article1])
    const freshCentroid = computeCentroid([article1, article2])

    // Third article should match this story: similar direction to article2
    const article3 = [0.85, 0.53]

    const staleMatch = cosineSimilarity(article3, stalecentroid)
    const freshMatch = cosineSimilarity(article3, freshCentroid)

    // Fresh centroid gives a higher similarity for the related article
    expect(freshMatch).toBeGreaterThan(staleMatch)
  })
})

/* ------------------------------------------------------------------ */
/*  recomputeStoryCentroid — error path coverage                       */
/* ------------------------------------------------------------------ */

describe('recomputeStoryCentroid', () => {
  it('pushes to errors when select fails', async () => {
    const errors: string[] = []
    const storyMap = new Map()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              returns: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'connection timeout' },
              }),
            }),
          }),
        }),
      })),
    } as any

    await recomputeStoryCentroid(client, 'story-1', storyMap, errors)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('connection timeout')
    expect(errors[0]).toContain('story-1')
  })

  it('pushes to errors when update fails', async () => {
    const errors: string[] = []
    const storyMap = new Map()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'articles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  returns: vi.fn().mockResolvedValue({
                    data: [{ embedding: [1, 0] }, { embedding: [0, 1] }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'permission denied' },
            }),
          }),
        }
      }),
    } as any

    await recomputeStoryCentroid(client, 'story-1', storyMap, errors)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('permission denied')
  })

  it('does not update storyMap when DB update fails', async () => {
    const errors: string[] = []
    const storyMap = new Map([
      ['story-1', { centroid: [1, 0], articleIds: ['a1'] }],
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'articles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  returns: vi.fn().mockResolvedValue({
                    data: [{ embedding: [1, 0] }, { embedding: [0, 1] }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'write failed' },
            }),
          }),
        }
      }),
    } as any

    await recomputeStoryCentroid(client, 'story-1', storyMap, errors)

    expect(storyMap.get('story-1')!.centroid).toEqual([1, 0])
  })

  it('pushes to errors when update matches zero rows (story deleted)', async () => {
    const errors: string[] = []
    const storyMap = new Map([
      ['story-1', { centroid: [1, 0], articleIds: ['a1'] }],
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'articles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  returns: vi.fn().mockResolvedValue({
                    data: [{ embedding: [1, 0] }, { embedding: [0, 1] }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
              count: 0,
            }),
          }),
        }
      }),
    } as any

    await recomputeStoryCentroid(client, 'story-1', storyMap, errors)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('zero rows')
    expect(errors[0]).toContain('story-1')
    // storyMap should not be updated
    expect(storyMap.get('story-1')!.centroid).toEqual([1, 0])
  })

  it('catches thrown exceptions from parseVector and pushes to errors', async () => {
    const errors: string[] = []
    const storyMap = new Map()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              returns: vi.fn().mockResolvedValue({
                data: [{ embedding: 'not-valid-json' }, { embedding: [0, 1] }],
                error: null,
              }),
            }),
          }),
        }),
      })),
    } as any

    await recomputeStoryCentroid(client, 'story-1', storyMap, errors)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('story-1')
  })

  it('catches rejected Supabase calls and pushes to errors', async () => {
    const errors: string[] = []
    const storyMap = new Map()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              returns: vi.fn().mockRejectedValue(new Error('network failure')),
            }),
          }),
        }),
      })),
    } as any

    await recomputeStoryCentroid(client, 'story-1', storyMap, errors)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('network failure')
  })
})

/* ------------------------------------------------------------------ */
/*  Threshold boundary behavior at 0.70                                */
/* ------------------------------------------------------------------ */

describe('threshold boundary behavior at 0.70', () => {
  function vectorWithSimilarity(sim: number): number[] {
    const theta = Math.acos(sim)
    return [Math.cos(theta), Math.sin(theta)]
  }

  it('rejects a pair below threshold (0.69)', () => {
    const clusters = normalizeClusters(
      clusterUnmatchedArticles(
        [makeArticle('a', [1, 0]), makeArticle('b', vectorWithSimilarity(0.69))],
        0.70
      )
    )
    expect(clusters).toEqual([['a'], ['b']])
  })

  it('joins a pair at threshold (0.70)', () => {
    const clusters = normalizeClusters(
      clusterUnmatchedArticles(
        [makeArticle('a', [1, 0]), makeArticle('b', vectorWithSimilarity(0.70))],
        0.70
      )
    )
    expect(clusters).toEqual([['a', 'b']])
  })

  it('joins a pair above threshold (0.705)', () => {
    const clusters = normalizeClusters(
      clusterUnmatchedArticles(
        [makeArticle('a', [1, 0]), makeArticle('b', vectorWithSimilarity(0.705))],
        0.70
      )
    )
    expect(clusters).toEqual([['a', 'b']])
  })
})

/* ------------------------------------------------------------------ */
/*  Pass 1 threshold boundary — matchArticleViaJs                      */
/* ------------------------------------------------------------------ */

describe('matchArticleViaJs threshold boundary at 0.70', () => {
  function vectorWithSimilarity(sim: number): number[] {
    const theta = Math.acos(sim)
    return [Math.cos(theta), Math.sin(theta)]
  }

  it('rejects match below threshold (0.69)', () => {
    const storyMap = new Map([
      ['story-1', { centroid: vectorWithSimilarity(0.69), articleIds: [] }],
    ])
    // Query embedding is [1, 0]; story centroid has cosine sim 0.69 to it
    const result = matchArticleViaJs([1, 0], storyMap, 0.70)
    expect(result).toBeNull()
  })

  it('accepts match at threshold (0.70)', () => {
    const storyMap = new Map([
      ['story-1', { centroid: vectorWithSimilarity(0.70), articleIds: [] }],
    ])
    const result = matchArticleViaJs([1, 0], storyMap, 0.70)
    expect(result).not.toBeNull()
    expect(result!.storyId).toBe('story-1')
    expect(result!.similarity).toBeCloseTo(0.70, 2)
  })

  it('accepts match above threshold (0.705)', () => {
    const storyMap = new Map([
      ['story-1', { centroid: vectorWithSimilarity(0.705), articleIds: [] }],
    ])
    const result = matchArticleViaJs([1, 0], storyMap, 0.70)
    expect(result).not.toBeNull()
    expect(result!.storyId).toBe('story-1')
  })

  it('picks the best match among multiple stories', () => {
    const storyMap = new Map([
      ['story-low', { centroid: vectorWithSimilarity(0.71), articleIds: [] }],
      ['story-high', { centroid: vectorWithSimilarity(0.90), articleIds: [] }],
    ])
    const result = matchArticleViaJs([1, 0], storyMap, 0.70)
    expect(result).not.toBeNull()
    expect(result!.storyId).toBe('story-high')
  })
})
