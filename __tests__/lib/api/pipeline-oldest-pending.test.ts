import { describe, it, expect, vi } from 'vitest'
import {
  queryOldestPendingByStage,
  queryStaleClaimCounts,
  queryReviewReasonBreakdown,
} from '@/lib/api/pipeline-oldest-pending'

function makeChain() {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(),
  }
  return chain
}

function makeClient(byTable: Record<string, ReturnType<typeof makeChain>>) {
  return {
    from: vi.fn((table: string) => byTable[table]),
  }
}

describe('queryOldestPendingByStage', () => {
  it('returns the earliest pending row per stage', async () => {
    const articles = makeChain()
    const stories = makeChain()

    let articlesCall = 0
    articles.maybeSingle = vi.fn(async () => {
      articlesCall += 1
      return articlesCall === 1
        ? { data: { created_at: '2026-04-22T00:00:00Z' }, error: null }
        : { data: { created_at: '2026-04-21T00:00:00Z' }, error: null }
    })
    stories.maybeSingle = vi.fn(async () => ({
      data: { created_at: '2026-04-20T00:00:00Z' },
      error: null,
    }))

    const client = makeClient({ articles, stories })
    const result = await queryOldestPendingByStage(client as never)

    expect(result.oldestEmbedPendingAt).toBe('2026-04-22T00:00:00Z')
    expect(result.oldestClusterPendingAt).toBe('2026-04-21T00:00:00Z')
    expect(result.oldestAssemblyPendingAt).toBe('2026-04-20T00:00:00Z')
  })

  it('returns nulls when nothing pending', async () => {
    const articles = makeChain()
    const stories = makeChain()
    articles.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    stories.maybeSingle = vi.fn(async () => ({ data: null, error: null }))

    const client = makeClient({ articles, stories })
    const result = await queryOldestPendingByStage(client as never)

    expect(result.oldestEmbedPendingAt).toBeNull()
    expect(result.oldestClusterPendingAt).toBeNull()
    expect(result.oldestAssemblyPendingAt).toBeNull()
  })

  it('throws when a query fails (surface DB/RLS errors in the SLO endpoint)', async () => {
    const articles = makeChain()
    const stories = makeChain()
    articles.maybeSingle = vi.fn(async () => ({ data: null, error: { message: 'rls denied' } }))
    stories.maybeSingle = vi.fn(async () => ({ data: null, error: null }))

    const client = makeClient({ articles, stories })
    await expect(queryOldestPendingByStage(client as never)).rejects.toThrow(/oldest embed pending failed: rls denied/)
  })
})

describe('queryStaleClaimCounts', () => {
  it('returns counts from the head select for each stage', async () => {
    const articles = makeChain()
    const stories = makeChain()

    // articles is consumed twice (embed + cluster)
    let articleCall = 0
    articles.lt = vi.fn(() => {
      articleCall += 1
      return Promise.resolve({ count: articleCall === 1 ? 5 : 7, error: null })
    }) as never

    stories.lt = vi.fn(() => Promise.resolve({ count: 2, error: null })) as never

    const client = makeClient({ articles, stories })
    const result = await queryStaleClaimCounts(client as never)

    expect(result.staleEmbedClaims).toBe(5)
    expect(result.staleClusterClaims).toBe(7)
    expect(result.staleAssemblyClaims).toBe(2)
  })

  it('treats missing counts as zero', async () => {
    const articles = makeChain()
    const stories = makeChain()
    articles.lt = vi.fn(() => Promise.resolve({ count: null, error: null })) as never
    stories.lt = vi.fn(() => Promise.resolve({ count: null, error: null })) as never

    const client = makeClient({ articles, stories })
    const result = await queryStaleClaimCounts(client as never)

    expect(result.staleEmbedClaims).toBe(0)
    expect(result.staleClusterClaims).toBe(0)
    expect(result.staleAssemblyClaims).toBe(0)
  })

  it('throws when a count query fails (so dashboard does not silently report 0)', async () => {
    const articles = makeChain()
    const stories = makeChain()
    articles.lt = vi.fn(() => Promise.resolve({ count: null, error: { message: 'rls denied' } })) as never
    stories.lt = vi.fn(() => Promise.resolve({ count: 0, error: null })) as never

    const client = makeClient({ articles, stories })
    await expect(queryStaleClaimCounts(client as never)).rejects.toThrow(/stale embed count failed: rls denied/)
  })
})

describe('queryReviewReasonBreakdown', () => {
  it('aggregates and sorts reasons by count', async () => {
    const stories = makeChain()
    let calls = 0
    stories.eq = vi.fn(() => {
      calls += 1
      if (calls === 2) {
        return Promise.resolve({
          data: [
            { review_reasons: ['sparse_coverage', 'ai_fallback'] },
            { review_reasons: ['sparse_coverage'] },
            { review_reasons: ['processing_anomaly'] },
            { review_reasons: null },
          ],
          error: null,
        })
      }
      return stories
    }) as never

    const client = makeClient({ stories })
    const result = await queryReviewReasonBreakdown(client as never)

    expect(result).toEqual([
      { reason: 'sparse_coverage', count: 2 },
      { reason: 'ai_fallback', count: 1 },
      { reason: 'processing_anomaly', count: 1 },
    ])
  })

  it('throws on query error', async () => {
    const stories = makeChain()
    let calls = 0
    stories.eq = vi.fn(() => {
      calls += 1
      if (calls === 2) {
        return Promise.resolve({ data: null, error: { message: 'boom' } })
      }
      return stories
    }) as never

    const client = makeClient({ stories })
    await expect(queryReviewReasonBreakdown(client as never)).rejects.toThrow(
      'Failed to load review reasons: boom'
    )
  })
})
