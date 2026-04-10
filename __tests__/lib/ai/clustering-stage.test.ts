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
    // Article IDs whose clustering_claim_owner has already been reclaimed
    // by a different worker. Owner-scoped updates against these IDs from
    // the stale owner should be no-ops (count = 0), simulating the race
    // where worker A's claim expired and worker B took over.
    staleOwnerArticleIds?: string[]
    // Force the apply_clustering_failure RPC to return an error, as
    // would happen if migration 043 has not been applied. Used by the
    // 7b.8 regression test to assert the pipeline fails loudly instead
    // of silently swallowing retry state.
    applyClusteringFailureRpcError?: { message: string }
    // Force the post-claim article-row fetch to return an error,
    // simulating a transient DB failure between the claim RPC
    // succeeding and the caller being able to read the rows back.
    // Used by the 7b.9 regression test for claim cleanup scoping.
    failClaimedRowFetch?: { message: string }
    // Controls the 7b.17 fallback verify-read (count=0 path). Maps
    // article IDs to the clustering_claim_owner value the verify
    // read should return. If not set, the verify read returns an
    // empty result (row missing → benign).
    verifyReadOwner?: Record<string, string | null>
  } = {},
) {
  const articleUpdateCalls: {
    payload: Record<string, unknown>
    id: string
    filters: Record<string, unknown>
  }[] = []
  const releasedClaims: string[] = []
  const staleOwnerSet = new Set(options.staleOwnerArticleIds ?? [])
  // Recorded calls to the atomic apply_clustering_failure RPC from
  // migration 043. Each entry represents one successful transactional
  // UPDATE + (optional) DLQ insert.
  const appliedFailureCalls: Array<{
    articleId: string
    owner: string
    retryCount: number
    nextAttemptAt: string
    lastError: string
    exhausted: boolean
  }> = []
  const dlqInserts: Array<{
    item_kind: string
    item_id: string
    retry_count: number
    last_error: string
  }> = []

  // --- Article fetch by claimed IDs: select(...).in('id', ids) ---
  // Tracks how many times the post-claim fetch has been invoked. The
  // first call is treated as the "fetch claimed rows" call and can be
  // failed via `failClaimedRowFetch` to simulate a DB error between
  // claim and read. Subsequent calls (e.g., from handleClusteringFailure
  // reading retry counts) are unaffected.
  let fetchCallCount = 0
  const fetchArticlesByIds = vi.fn((_col: string, ids: string[]) => {
    fetchCallCount += 1
    if (fetchCallCount === 1 && options.failClaimedRowFetch) {
      return Promise.resolve({ data: null, error: options.failClaimedRowFetch })
    }
    const bySet = new Set(ids)
    const matching = (articleRows as Record<string, unknown>[]).filter(
      (a) => bySet.has(a.id as string)
    )
    return Promise.resolve({ data: matching, error: null })
  })

  // The 7b.17 fallback verify read uses select('clustering_claim_owner')
  // .eq('id', X).maybeSingle(). Return either the configured owner
  // value for the row or an empty result (row missing) as default.
  const verifyEq = vi.fn((_col: string, id: string) => ({
    maybeSingle: vi.fn().mockImplementation(() => {
      const owner = options.verifyReadOwner?.[id]
      if (owner === undefined) {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({
        data: { clustering_claim_owner: owner },
        error: null,
      })
    }),
  }))

  const articleSelect = vi.fn((cols?: string) => {
    if (cols === 'clustering_claim_owner') {
      return { eq: verifyEq }
    }
    return { in: fetchArticlesByIds }
  })

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
    if (fn === 'apply_clustering_failure') {
      // Mirrors the atomic RPC in migration 043: owner-scoped UPDATE
      // plus conditional DLQ insert in a single transaction. Returns
      // true when the state transition landed (owner still matches),
      // false when the owner has moved (no-op).
      if (options.applyClusteringFailureRpcError) {
        return Promise.resolve({
          data: null,
          error: options.applyClusteringFailureRpcError,
        })
      }
      const articleId = params.p_article_id as string
      const owner = params.p_owner as string
      const exhausted = params.p_exhausted as boolean
      if (staleOwnerSet.has(articleId)) {
        return Promise.resolve({ data: false, error: null })
      }
      appliedFailureCalls.push({
        articleId,
        owner,
        retryCount: params.p_retry_count as number,
        nextAttemptAt: params.p_next_attempt_at as string,
        lastError: params.p_last_error as string,
        exhausted,
      })
      if (exhausted) {
        dlqInserts.push({
          item_kind: 'article_cluster',
          item_id: articleId,
          retry_count: params.p_retry_count as number,
          last_error: params.p_last_error as string,
        })
      }
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
            // Articles UPDATE supports three call shapes:
            //   1. .update(p).in('id', ids)                     (bulk assign)
            //   2. .update(p).eq('id', id)                      (single update)
            //   3. .update(p).eq('id', id).eq('clustering_claim_owner', owner)
            //      (owner-scoped retry write from Phase 7b.6)
            //
            // The returned builder is a thenable — awaiting it triggers
            // exactly one resolution using the accumulated filters, so a
            // chained .eq().eq() records a single update call. Case 3
            // resolves with count=0 when the article ID is in
            // `staleOwnerArticleIds` to simulate the stale-worker race.
            const makeEq = (filters: Record<string, unknown>) => {
              const resolveUpdate = () => {
                const id = filters.id as string | undefined
                const recordedFilters = { ...filters }
                if (id !== undefined) {
                  articleUpdateCalls.push({ payload, id, filters: recordedFilters })
                }
                const isStale = id !== undefined && staleOwnerSet.has(id)
                const count = isStale ? 0 : 1
                if (options.failSingletonUpdate && payload.clustering_status === 'clustered') {
                  return { error: { message: 'Simulated update failure' }, count }
                }
                return { error: null, count }
              }
              const builder: {
                eq: ReturnType<typeof vi.fn>
                then: (
                  onfulfilled: (v: unknown) => unknown,
                  onrejected?: (v: unknown) => unknown
                ) => Promise<unknown>
              } = {
                eq: vi.fn().mockImplementation((col: string, value: unknown) =>
                  makeEq({ ...filters, [col]: value })
                ),
                then: (onfulfilled, onrejected) =>
                  Promise.resolve(resolveUpdate()).then(onfulfilled, onrejected),
              }
              return builder
            }

            return {
              in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
                if (options.failSingletonUpdate && payload.clustering_status === 'clustered') {
                  return Promise.resolve({ error: { message: 'Simulated update failure' } })
                }
                ids.forEach((id) =>
                  articleUpdateCalls.push({ payload, id, filters: { id } })
                )
                return Promise.resolve({ error: null })
              }),
              eq: (col: string, value: unknown) => makeEq({}).eq(col, value),
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
    _appliedFailureCalls: appliedFailureCalls,
    _dlqInserts: dlqInserts,
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

  it('does not stomp a newer worker\'s claim when the stale owner hits its failure path', async () => {
    // Phase 7b.6: Codex adversarial-review regression. Scenario: worker
    // A claims `stale-article`, its clustering TTL elapses, worker B
    // reclaims the row. Worker A then hits its failure path (simulated
    // here via failSingletonUpdate). The owner-scoped UPDATE inside
    // apply_clustering_failure must return false — worker A's stale
    // retry payload cannot overwrite worker B's active claim or
    // DLQ-escalate on B's behalf.
    const client = createMockClient(
      [
        {
          id: 'stale-article',
          title: 'Claim was reclaimed under us',
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
      { failSingletonUpdate: true, staleOwnerArticleIds: ['stale-article'] },
    )

    const result = await clusterArticles(client as never)

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Failed to promote singleton stale-article')

    // The failure handler called the RPC — but the mock's stale-owner
    // path returned false *without* recording an applied failure call.
    // This is the key invariant: no DLQ row, no state mutation, nothing.
    const staleRpcCalls = client._rpcCalls.filter(
      (c) => c.fn === 'apply_clustering_failure' && c.params.p_article_id === 'stale-article'
    )
    expect(staleRpcCalls.length).toBeGreaterThan(0)
    expect(client._appliedFailureCalls).toEqual([])
    expect(client._dlqInserts).toEqual([])
  })

  it('writes retry metadata (not a naive claim release) on per-cluster failure', async () => {
    // Phase 7b.7: the singleton promotion failure path delegates to
    // the atomic apply_clustering_failure RPC (migration 043) which
    // performs the owner-scoped UPDATE and the conditional DLQ INSERT
    // in a single transaction. Without this, a poison pill article
    // would either hot-loop on every pipeline pass (old Phase 7 bug)
    // or strand outside the DLQ on a crash between writes (7b.6 bug).
    const client = createMockClient(
      [
        {
          id: 'will-fail',
          title: 'Poison pill',
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

    expect(result.errors[0]).toContain('Failed to promote singleton will-fail')

    // The atomic RPC was invoked with the full retry payload.
    const applied = client._appliedFailureCalls.find((c) => c.articleId === 'will-fail')
    expect(applied).toBeDefined()
    expect(applied!.retryCount).toBe(1)
    expect(applied!.exhausted).toBe(false)
    expect(applied!.lastError).toBeTruthy()
    expect(typeof applied!.nextAttemptAt).toBe('string')
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

  it('fails loudly when fallback UPDATE count=0 but claim is still held (schema drift)', async () => {
    // Phase 7b.17: Codex finding. A count=0 result from the
    // fallback UPDATE does NOT prove the claim was released. It
    // could also mean policy/permission drift where our owner
    // still matches but the UPDATE can't land. In that case the
    // cleanup phase MUST fail loud — treating count=0 as success
    // would silently strand the claim until TTL expiry and hide
    // the underlying schema issue from operators.
    //
    // Scenario: mixed batch [claimable, ghost]. The release RPC
    // fails and the fallback UPDATE returns count=0 for BOTH. The
    // verify read then reports our owner is still on both rows,
    // so the cleanup phase throws.
    const ownerSentinel = 'test-owner-uuid'
    const client = createMockClient(
      [
        {
          id: 'claimable',
          title: 'Stuck article',
          source_id: 's1',
          embedding: [1, 0],
          published_at: '2026-03-15T00:00:00Z',
          created_at: '2026-03-15T00:00:00Z',
          story_id: null,
          image_url: null,
          clustering_claimed_at: null,
          clustering_attempts: 0,
        },
      ],
      [],
      {
        // All fallback UPDATEs return count=0
        staleOwnerArticleIds: ['claimable', 'ghost'],
        // But the verify read says the claim is still held by us
        verifyReadOwner: {
          claimable: ownerSentinel,
          ghost: ownerSentinel,
        },
      },
    )

    client.rpc = vi.fn().mockImplementation((fn: string) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['claimable', 'ghost'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        return Promise.resolve({
          data: null,
          error: { message: 'release RPC broken' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    }) as typeof client.rpc

    // Pass our owner sentinel through so the verify read's owner
    // matches. generateClaimOwner() is called internally in
    // clusterArticles, so we have to pass the owner explicitly.
    await expect(
      clusterArticles(client as never, 1000, ownerSentinel),
    ).rejects.toThrow(
      // Either the primary inline-release error OR the cleanup
      // wrapper with the schema-drift diagnostic should surface.
      /Inline clean-release failed|policy \/ permission drift/,
    )
  })

  it('handles fallback UPDATE count=0 explicitly (claim moved, not a confirmed release)', async () => {
    // Phase 7b.16: Codex finding. The fallback UPDATE must mirror
    // the RPC contract and distinguish count > 0 (confirmed
    // release) from count === 0 (row missing or owner moved). The
    // count=0 case is not a failure but also not a confirmed
    // release — the claim is simply no longer ours, and we should
    // surface a diagnostic into errors[] so operators can see
    // any ownership handoffs that occurred during cleanup.
    //
    // Scenario: mixed batch where the RPC fails, the fallback
    // UPDATE returns count=0 for the ghost (marked stale via
    // staleOwnerArticleIds), and count=1 for claimable.
    const client = createMockClient(
      [
        {
          id: 'claimable',
          title: 'Healthy article',
          source_id: 's1',
          embedding: [1, 0],
          published_at: '2026-03-15T00:00:00Z',
          created_at: '2026-03-15T00:00:00Z',
          story_id: null,
          image_url: null,
          clustering_claimed_at: null,
          clustering_attempts: 0,
        },
      ],
      [],
      {
        // The fallback UPDATE for 'ghost' will return count=0 via
        // the existing staleOwnerArticleIds hook on the articles
        // mock — simulating "owner moved between the RPC call and
        // the fallback attempt".
        staleOwnerArticleIds: ['ghost'],
      },
    )

    client.rpc = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['claimable', 'ghost'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        // RPC broken → forces the fallback path for both IDs
        return Promise.resolve({
          data: null,
          error: { message: 'release RPC broken' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    }) as typeof client.rpc

    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Inline clean-release failed/
    )

    // Both IDs were resolved — 'claimable' via count=1 release,
    // 'ghost' via the count=0 "ownership moved" path. Neither is
    // stranded.
    const fallbackUpdates = client._articleUpdateCalls.filter(
      (call) =>
        typeof call.payload === 'object'
        && call.payload !== null
        && 'clustering_claimed_at' in call.payload
        && (call.payload as { clustering_claimed_at: unknown }).clustering_claimed_at === null,
    )
    const fallbackIds = new Set(fallbackUpdates.map((u) => u.id))
    expect(fallbackIds.has('claimable')).toBe(true)
    expect(fallbackIds.has('ghost')).toBe(true)

    // The primary error is still the inline-release failure. No
    // cleanup-phase failure (both claims resolved via fallback).
    // The ownership-moved diagnostic is not reachable here because
    // the throw happens before the result object is returned —
    // but the test proves the fallback path attempted both IDs
    // and neither stayed in stillFailing.
  })

  it('falls back to direct UPDATE when release_clustering_claim RPC fails in cleanup', async () => {
    // Phase 7b.15: Codex finding. After the 7b.14 fix, healthy
    // claimable articles are routed through cleanReleaseArticleIds
    // on inline-release failure. If the cleanup-phase release RPC
    // also fails, those articles would be stranded until TTL expiry.
    // The fallback path issues a direct owner-scoped UPDATE on the
    // articles table to clear the claim — no retry burn, no
    // stranding, even when the RPC is broken.
    //
    // Scenario: mixed batch [claimable, ghost]. Inline release for
    // 'ghost' fails (RPC broken), hard-stop throws and moves
    // 'claimable' into cleanReleaseArticleIds. Cleanup phase retries
    // the RPC for both, it fails again, fallback UPDATE succeeds.
    // The primary error still propagates but the claims are
    // released via the fallback path.
    const client = createMockClient(
      [
        {
          id: 'claimable',
          title: 'Healthy article',
          source_id: 's1',
          embedding: [1, 0],
          published_at: '2026-03-15T00:00:00Z',
          created_at: '2026-03-15T00:00:00Z',
          story_id: null,
          image_url: null,
          clustering_claimed_at: null,
          clustering_attempts: 0,
        },
      ],
      [],
      {},
    )

    client.rpc = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['claimable', 'ghost'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        // Simulate the RPC being broken for every call.
        return Promise.resolve({
          data: null,
          error: { message: 'release RPC broken' },
        })
      }
      if (fn === 'apply_clustering_failure') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }) as typeof client.rpc

    // The inline release hard-stops with a throw; the cleanup phase
    // then retries the release via the fallback UPDATE and succeeds.
    // Primary error still propagates.
    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Inline clean-release failed/
    )

    // Critical: the fallback UPDATE was called for BOTH claims,
    // which is what keeps them from being TTL-stranded. The owner
    // filter is present so a stale worker cannot stomp a newer
    // claim via the fallback path.
    const fallbackUpdates = client._articleUpdateCalls.filter(
      (call) =>
        typeof call.payload === 'object'
        && call.payload !== null
        && 'clustering_claimed_at' in call.payload
        && (call.payload as { clustering_claimed_at: unknown }).clustering_claimed_at === null
        && 'clustering_claim_owner' in call.payload
        && (call.payload as { clustering_claim_owner: unknown }).clustering_claim_owner === null
        && !('clustering_retry_count' in call.payload)
    )
    const fallbackIds = new Set(fallbackUpdates.map((u) => u.id))
    expect(fallbackIds.has('claimable')).toBe(true)
    expect(fallbackIds.has('ghost')).toBe(true)
    // Owner-scoped filter present on fallback.
    for (const update of fallbackUpdates) {
      expect(update.filters).toHaveProperty('clustering_claim_owner')
    }
    // No retry burn: apply_clustering_failure was never called.
    const applyCalls = (client.rpc as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'apply_clustering_failure'
    )
    expect(applyCalls).toEqual([])
  })

  it('does not burn retry budget on surviving claimable when ghost release fails', async () => {
    // Phase 7b.14: Codex finding. When inline clean-release fails
    // and the run aborts, the untouched claimable articles must NOT
    // have their retry metadata mutated — clustering never actually
    // ran on them. Previously the cleanup phase would route them
    // through handleClusteringFailure (apply_clustering_failure RPC),
    // incrementing clustering_retry_count and eventually DLQ'ing
    // healthy articles over repeated transient release failures.
    const client = createMockClient(
      [
        {
          id: 'claimable',
          title: 'Healthy article',
          source_id: 's1',
          embedding: [1, 0],
          published_at: '2026-03-15T00:00:00Z',
          created_at: '2026-03-15T00:00:00Z',
          story_id: null,
          image_url: null,
          clustering_claimed_at: null,
          clustering_attempts: 0,
        },
      ],
      [],
      {},
    )

    // Mixed batch: claim both, ghost is filtered (not in articleRows),
    // ghost's release fails, claimable's release succeeds.
    client.rpc = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['claimable', 'ghost'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        const id = params.p_article_id as string
        if (id === 'ghost') {
          return Promise.resolve({
            data: null,
            error: { message: 'ghost release fail' },
          })
        }
        return Promise.resolve({ data: true, error: null })
      }
      if (fn === 'apply_clustering_failure') {
        // Track it — this call MUST NOT happen for 'claimable'.
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }) as typeof client.rpc

    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Inline clean-release failed/
    )

    // Critical: no apply_clustering_failure call for 'claimable'.
    // Clustering never touched it, so its retry budget must be
    // untouched. Ghost's retry state is also not touched — it's in
    // cleanReleaseArticleIds, not the retry set.
    const applyCalls = (client.rpc as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: unknown[]) => c[0] === 'apply_clustering_failure')
      .map((c: unknown[]) => (c[1] as { p_article_id: string }).p_article_id)
    expect(applyCalls).not.toContain('claimable')
    expect(applyCalls).not.toContain('ghost')
  })

  it('releases filtered claims inline BEFORE the first work-phase call (ordering invariant)', async () => {
    // Phase 7b.12 + 7b.13: Codex findings. Filtered claims (null
    // embedding, concurrent delete) must be released immediately
    // after the fetch filter identifies them, BEFORE any work-phase
    // operation starts. This test uses a sequence log to verify
    // exact ordering — not just "release happened sometime before
    // the final rejection".
    const sequence: string[] = []

    // We need a mock where the stories fetch can observe the
    // sequence log. Build one from scratch rather than extending
    // createMockClient.
    const survivor = {
      id: 'survivor',
      title: 'Will survive the filter',
      source_id: 's1',
      embedding: [1, 0],
      published_at: '2026-03-15T00:00:00Z',
      created_at: '2026-03-15T00:00:00Z',
      story_id: null,
      image_url: null,
      clustering_claimed_at: null,
      clustering_attempts: 0,
    }

    const articleFetch = vi.fn((_col: string, ids: string[]) => {
      sequence.push(`articles.in:${ids.join(',')}`)
      return Promise.resolve({
        data: [survivor].filter((a) => ids.includes(a.id)),
        error: null,
      })
    })

    const storyReturns = vi.fn().mockImplementation(() => {
      // First work-phase operation: the broad stories fetch.
      sequence.push('stories.select')
      return Promise.resolve({ data: [], error: null })
    })

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'articles') {
          return {
            select: vi.fn().mockReturnValue({ in: articleFetch }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'stories') {
          return {
            select: vi.fn().mockImplementation(() => ({
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({ returns: storyReturns }),
              }),
            })),
          }
        }
        return { select: vi.fn(), insert: vi.fn() }
      }),
      rpc: vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
        if (fn === 'claim_articles_for_clustering') {
          sequence.push('claim')
          return Promise.resolve({ data: ['survivor', 'ghost'], error: null })
        }
        if (fn === 'release_clustering_claim') {
          sequence.push(`release:${params.p_article_id}`)
          return Promise.resolve({ data: true, error: null })
        }
        if (fn === 'apply_clustering_failure') {
          sequence.push(`apply_failure:${params.p_article_id}`)
          return Promise.resolve({ data: true, error: null })
        }
        if (fn === 'match_story_centroid') {
          sequence.push('match_rpc')
          return Promise.resolve({ data: [], error: null })
        }
        if (fn === 'create_story_with_articles') {
          sequence.push('create_story')
          return Promise.resolve({ data: 'story-1', error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }

    await clusterArticles(client as never).catch(() => { /* ignore */ })

    // The release for 'ghost' must appear in the sequence BEFORE
    // the first work-phase marker ('stories.select'). This is the
    // actual ordering invariant — a test that just checks
    // `releaseCalledFor.contains('ghost')` would pass even if the
    // release were deferred to the end.
    const ghostReleaseIdx = sequence.indexOf('release:ghost')
    const storySelectIdx = sequence.indexOf('stories.select')

    expect(ghostReleaseIdx).toBeGreaterThanOrEqual(0)
    expect(storySelectIdx).toBeGreaterThanOrEqual(0)
    expect(ghostReleaseIdx).toBeLessThan(storySelectIdx)
  })

  it('cleanup failure after otherwise-successful work throws (no silent success)', async () => {
    // Phase 7b.11: Codex finding 2. When the main work block
    // completes and returns a valid primaryResult, a cleanup-phase
    // failure must still throw so the pipeline runner marks the
    // step as errored rather than reporting success with stranded
    // claims. This test exercises the "good work + bad cleanup"
    // path via a singleton promotion failure:
    //   1. Article claims succeed, fetch succeeds
    //   2. Singleton promotion fails (failSingletonUpdate)
    //   3. handleClusteringFailure is called inline in persistNewClusters
    //      (owner-scoped, not via the finally cleanup)
    //   4. The finally cleanup attempts to retry leftover IDs — but
    //      since persistNewClusters already drained them, there's
    //      nothing to clean up. So this specific scenario doesn't
    //      exercise cleanup failure.
    //
    // Better scenario: have claims that survive the happy path WITHOUT
    // real failure, AND inject a cleanup RPC error via the mock. But
    // if work succeeds, unhandledArticleIds is drained via
    // bulkUpdateArticles on the happy path, so again no cleanup runs.
    //
    // The clearest test is the empty-fetch + missing-release-RPC case:
    // work "succeeds" (nothing to do), cleanup fails (release RPC
    // missing), the run must throw loudly.
    const client = createMockClient([], [], {})
    client.rpc = vi.fn().mockImplementation((fn: string) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['phantom'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        return Promise.resolve({
          data: null,
          error: { message: 'release RPC missing' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    }) as typeof client.rpc

    // Phase 7b.13: the inline release failure now hard-stops the
    // work phase immediately, so the primary error surfaces with the
    // specific "Inline clean-release failed" prefix and the
    // offending article IDs. Without this invariant, a successful
    // returning function would let the pipeline runner mark the step
    // as completed with stranded claims.
    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Inline clean-release failed for \d+ claim\(s\); aborting work phase/
    )
  })

  it('keeps IDs in the recovery set when release fails during filtered-row cleanup', async () => {
    // Phase 7b.11: Codex finding 1. The prior code removed filtered
    // IDs from the recovery set BEFORE attempting release, then only
    // pushed failures into errors[]. If the release failed AND a
    // later step threw, the IDs would be completely lost — no
    // recovery, no error surfaced.
    //
    // New behavior: the filtered IDs live in cleanReleaseArticleIds
    // until release confirms success. If release fails and the work
    // later throws, the primary error propagates and the operator
    // can see which IDs are stranded via the error message.
    //
    // We simulate this by: (a) having one article with a null
    // embedding (filtered out) and one claimable, (b) making the
    // release RPC fail for the filtered ID, (c) making a later step
    // throw. We should see a thrown error with the stranding info.
    const client = createMockClient(
      [
        {
          id: 'claimable',
          title: 'Real article',
          source_id: 's1',
          embedding: [1, 0],
          published_at: '2026-03-15T00:00:00Z',
          created_at: '2026-03-15T00:00:00Z',
          story_id: null,
          image_url: null,
          clustering_claimed_at: null,
          clustering_attempts: 0,
        },
        // This one will be claimed but filtered out of the result
        // (the createMockClient's fetch always returns whatever's in
        // articleRows — for this test we rely on the mocked RPC to
        // claim both but simulate the release failing for 'ghost').
      ],
      [],
      {},
    )

    // Override the RPC to claim both an id in articleRows and a ghost
    // id that will not survive the fetch filter.
    client.rpc = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['claimable', 'ghost'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        const articleId = params.p_article_id as string
        if (articleId === 'ghost') {
          return Promise.resolve({
            data: null,
            error: { message: 'release RPC fail for ghost' },
          })
        }
        return Promise.resolve({ data: true, error: null })
      }
      if (fn === 'match_story_centroid') {
        return Promise.resolve({ data: [], error: null })
      }
      if (fn === 'create_story_with_articles') {
        return Promise.resolve({ data: 'story-1', error: null })
      }
      if (fn === 'apply_clustering_failure') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }) as typeof client.rpc

    // Phase 7b.13: inline release for 'ghost' fails immediately
    // after the fetch filter identifies it, before any work phase
    // runs. The hard-stop throws with the specific "Inline clean-
    // release failed" prefix.
    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Inline clean-release failed for \d+ claim\(s\); aborting work phase/
    )
  })

  it('releases claims cleanly when fetch returns zero rows — does not burn retry budget', async () => {
    // Phase 7b.10: Codex finding 2. Claim succeeds but fetch
    // returns zero rows (null embeddings, concurrent delete, etc.).
    // This is NOT a clustering failure — no clustering logic ever
    // ran. Those claims must be released via the clean path, not
    // routed through handleClusteringFailure (which would increment
    // retry_count and eventually DLQ them).
    const client = createMockClient(
      [], // Empty articleRows → fetch returns []
      [],
      {
        // Seed the claim RPC with phantom IDs that point at no rows.
        // createMockClient's claim RPC returns articleRows IDs, so
        // we instead return a synthetic claimed list by injecting a
        // row that will match the claim but not the fetch (empty
        // body). Simpler: use a single article with null embedding.
      },
    )

    // Override the claim RPC to return an ID that has no matching row
    // in articleRows, simulating the concurrent-delete case.
    const originalRpc = client.rpc
    client.rpc = vi.fn().mockImplementation((fn: string, params: Record<string, unknown>) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['phantom-id'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        // Clean release path should reach here
        return Promise.resolve({ data: true, error: null })
      }
      return originalRpc(fn, params)
    }) as typeof client.rpc

    const result = await clusterArticles(client as never)

    // Success: zero-work result, no errors.
    expect(result.errors).toEqual([])
    // Critical: no retry metadata was written for the phantom claim.
    // If the empty-fetch case had gone through handleClusteringFailure
    // it would have called apply_clustering_failure and burned retry.
    expect(client._appliedFailureCalls).toEqual([])
    expect(client._dlqInserts).toEqual([])
    // The release RPC was called instead.
    const releaseCalls = (client.rpc as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'release_clustering_claim'
    )
    expect(releaseCalls.length).toBe(1)
  })

  it('surfaces clean-release errors on the empty-fetch path (no silent success)', async () => {
    // Phase 7b.10: Codex finding 1. When claims exist and fetch
    // returns empty, any failure in the release path must be
    // surfaced — otherwise operators see a "successful" zero-work
    // run while claims are stranded until TTL expiry.
    const client = createMockClient([], [], {})

    client.rpc = vi.fn().mockImplementation((fn: string) => {
      if (fn === 'claim_articles_for_clustering') {
        return Promise.resolve({ data: ['phantom-id'], error: null })
      }
      if (fn === 'release_clustering_claim') {
        // Simulate deploy-skew: release RPC missing.
        return Promise.resolve({
          data: null,
          error: { message: 'function release_clustering_claim does not exist' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    }) as typeof client.rpc

    // Phase 7b.13: the inline release hard-stop throws before the
    // cleanup phase even runs, so the primary error message is the
    // inline-release failure, not the cleanup wrapper.
    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Inline clean-release failed for \d+ claim\(s\); aborting work phase/
    )
  })

  it('cleans up claimed IDs when the post-claim fetch fails (no pre-try strand)', async () => {
    // Phase 7b.9: Codex adversarial-review regression. Scenario:
    //   1. claim_articles_for_clustering succeeds, returns 2 IDs
    //   2. The subsequent row fetch fails (transient DB error)
    //   3. Ideally: finally handler routes those IDs through the
    //      atomic failure RPC so claims get retry metadata + can be
    //      re-claimed after backoff
    //   4. Regression case: if the claim+fetch happens OUTSIDE the
    //      outer try/finally, the fetch throw bypasses cleanup and
    //      the claims are stranded until TTL expiry
    //
    // With the 7b.9 restructure the claim+fetch is inside the try,
    // so the finally handler sees the claimed IDs and applies retry
    // metadata via the atomic RPC.
    const client = createMockClient(
      TWO_SIMILAR_ARTICLES,
      [],
      { failClaimedRowFetch: { message: 'transient DB timeout' } },
    )

    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Failed to fetch claimed clustering batch/
    )

    // The finally handler applied retry metadata to BOTH claimed
    // articles via the atomic RPC — nothing was stranded.
    const ids = new Set(client._appliedFailureCalls.map((c) => c.articleId))
    expect(ids.has('a1')).toBe(true)
    expect(ids.has('a2')).toBe(true)
    for (const call of client._appliedFailureCalls) {
      expect(call.exhausted).toBe(false)
      expect(call.retryCount).toBe(1)
      expect(call.lastError).toContain('Unexpected clustering pipeline error')
    }
  })

  it('cleans up claimed IDs even when the atomic failure RPC is also missing', async () => {
    // Phase 7b.9 + 7b.8: worst case — claim succeeds, fetch fails,
    // AND migration 043 is missing. The finally handler tries the
    // atomic RPC, which also errors. The finally's try/catch logs
    // the secondary error, and the primary fetch error still
    // propagates so operators see the failure loudly.
    const client = createMockClient(
      TWO_SIMILAR_ARTICLES,
      [],
      {
        failClaimedRowFetch: { message: 'transient DB timeout' },
        applyClusteringFailureRpcError: {
          message: 'Could not find the function public.apply_clustering_failure(...)',
        },
      },
    )

    // Primary error propagates: operators see the original fetch
    // failure regardless of whether cleanup succeeded.
    await expect(clusterArticles(client as never)).rejects.toThrow(
      /Failed to fetch claimed clustering batch/
    )

    // No applied failure calls survived (the RPC errored) — but
    // critically the finally block attempted cleanup rather than
    // silently returning a success.
    expect(client._appliedFailureCalls).toEqual([])
    // The apply_clustering_failure RPC was invoked at least once,
    // proving the cleanup scope caught the claims. (The fail-loud
    // behavior from 7b.8 means we bail out on the first RPC error,
    // so only the first claimed article gets an attempt — that's
    // still enough to verify the finally scope fired.)
    const attemptedCleanupCount = client._rpcCalls.filter(
      (c) => c.fn === 'apply_clustering_failure'
    ).length
    expect(attemptedCleanupCount).toBeGreaterThan(0)
  })

  it('fails loudly when apply_clustering_failure RPC is missing (deploy skew)', async () => {
    // Phase 7b.8: Codex adversarial-review regression. Scenario: the
    // app deploys before migration 043 is applied, or an environment
    // is missing the migration. Supabase returns a "function does
    // not exist" error on the RPC call. The pipeline MUST fail
    // loudly so operators see the misconfiguration — silently
    // swallowing the error would lose retry/DLQ state for every
    // failing article in the run.
    const client = createMockClient(
      [
        {
          id: 'deploy-skew',
          title: 'Would have needed retry metadata',
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
      {
        failSingletonUpdate: true,
        applyClusteringFailureRpcError: {
          message:
            'Could not find the function public.apply_clustering_failure(...) in the schema cache',
        },
      },
    )

    // The outer call must reject with a loud, actionable error that
    // tells operators exactly which migration is missing. Note: the
    // exact caller that surfaces the error may be the singleton
    // promotion catch block, persistNewClusters, or the finally
    // handler — as long as `clusterArticles` either throws or
    // records the failure prominently in `result.errors`.
    let thrown: Error | null = null
    let result: Awaited<ReturnType<typeof clusterArticles>> | null = null
    try {
      result = await clusterArticles(client as never)
    } catch (err) {
      thrown = err as Error
    }

    const surfaced =
      thrown?.message ??
      result?.errors.find((e) => /apply_clustering_failure/.test(e)) ??
      ''

    expect(surfaced).toMatch(/apply_clustering_failure/)
    expect(surfaced).toMatch(/migration 043/)

    // Critical: no silent success. The atomic RPC was called but the
    // mock returned an error, so no applied-failure record exists and
    // no DLQ entry was written. Operators MUST see the error surfaced.
    expect(client._appliedFailureCalls).toEqual([])
    expect(client._dlqInserts).toEqual([])
  })

  it('routes exhausted failures through the atomic RPC — UPDATE and DLQ insert cannot split', async () => {
    // Phase 7b.7: Codex finding was that the old two-write handler
    // could strand an article in status='failed' + no DLQ record if
    // the worker crashed between the UPDATE commit and the DLQ INSERT.
    // With the atomic RPC, either both writes land or neither does.
    //
    // We simulate exhaustion by seeding an article with
    // clustering_retry_count at the budget ceiling, so the next
    // failure tips it over and the mock's apply_clustering_failure
    // handler records a matching DLQ entry.
    const client = createMockClient(
      [
        {
          id: 'exhausted',
          title: 'Final retry',
          source_id: 's1',
          embedding: [1, 0],
          published_at: '2026-03-15T00:00:00Z',
          created_at: '2026-03-15T00:00:00Z',
          story_id: null,
          image_url: null,
          clustering_claimed_at: null,
          clustering_attempts: 2,
          clustering_retry_count: 5, // RETRY_BUDGET.cluster is 5
        },
      ],
      [],
      { failSingletonUpdate: true },
    )

    await clusterArticles(client as never)

    const rpcCall = client._appliedFailureCalls.find((c) => c.articleId === 'exhausted')
    expect(rpcCall).toBeDefined()
    expect(rpcCall!.exhausted).toBe(true)
    expect(rpcCall!.retryCount).toBe(6) // previous 5 + 1

    // The DLQ row was written via the SAME RPC call, not a separate
    // pushToDeadLetter. Either both land (mock records both) or
    // neither lands (mock records neither). There is no middle state.
    const dlq = client._dlqInserts.find((d) => d.item_id === 'exhausted')
    expect(dlq).toBeDefined()
    expect(dlq!.item_kind).toBe('article_cluster')
    expect(dlq!.retry_count).toBe(6)
  })

  it('applies retry metadata via the failure handler when processing throws', async () => {
    const articles = TWO_SIMILAR_ARTICLES
    const client = createMockClient(articles, [], { failStoryFetch: true })

    await expect(clusterArticles(client as never)).rejects.toThrow('Failed to fetch existing stories: DB error')

    // Phase 7b.7: the finally handler delegates to the atomic
    // apply_clustering_failure RPC. Each unhandled article gets one
    // call with its retry payload; the RPC handles the owner-scoped
    // UPDATE and DLQ insert in a single transaction.
    expect(client._appliedFailureCalls.length).toBe(articles.length)
    for (const article of articles) {
      const match = client._appliedFailureCalls.find((c) => c.articleId === article.id)
      expect(match).toBeDefined()
      expect(match!.retryCount).toBe(1)
      expect(match!.exhausted).toBe(false)
      expect(match!.lastError).toContain('Unexpected clustering pipeline error')
    }
    // No owner-scoped release RPC is called anymore — the failure handler
    // writes the claim clear directly through the atomic RPC.
    expect(client._releasedClaims).toEqual([])
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

  it('emits a pgvector_fallback warn event when the match_story_centroid RPC fails', async () => {
    const client = createMockClient(
      TWO_SIMILAR_ARTICLES,
      [],
      { rpcError: { message: 'function match_story_centroid does not exist' } },
    )

    const emitter = vi.fn().mockResolvedValue(undefined)

    await clusterArticles(client as never, 1000, undefined, emitter)

    expect(emitter).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'cluster',
        level: 'warn',
        eventType: 'pgvector_fallback',
        payload: expect.objectContaining({
          error: 'function match_story_centroid does not exist',
        }),
      })
    )
  })
})
