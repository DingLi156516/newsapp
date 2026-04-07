import { cosineSimilarity, computeCentroid, clusterUnmatchedArticles } from '@/lib/ai/clustering'
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
