import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/ai/gemini-client', () => ({
  generateEmbeddingBatch: vi.fn(),
}))

import { embedUnembeddedArticles } from '@/lib/ai/embeddings'
import { generateEmbeddingBatch } from '@/lib/ai/gemini-client'

const mockGenerateEmbeddingBatch = vi.mocked(generateEmbeddingBatch)

interface MockArticleRow {
  id: string
  title: string
  description: string | null
  title_fingerprint: string | null
  // Optional: simulates what the atomic claim RPC's expiry filter would see.
  embedding_claimed_at?: string | null
  embedding_retry_count?: number
}

const CLAIM_TTL_MS = 30 * 60 * 1000

function createMockClient(
  articles: MockArticleRow[] | null,
  fetchError: unknown = null,
  updateError: unknown = null,
  cacheRows: unknown[] = [],
  cacheError: unknown = null
) {
  // --- update(payload, { count: 'exact' }).eq('id').eq('embedding_claim_owner') path
  //     used by runOwnerScopedUpdate for both success and failure writes. ---
  const updateResolved = { error: updateError, count: updateError ? null : 1 }
  const ownerEq = vi.fn().mockResolvedValue(updateResolved)
  const idEq = vi.fn().mockReturnValue({ eq: ownerEq })
  const update = vi.fn().mockReturnValue({ eq: idEq })

  // --- verify-read chain invoked by runOwnerScopedUpdate when count===0.
  //     On the happy path count is already 1, so this is defensive only. ---
  const verifyMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: null, error: null })
  const verifyEq = vi.fn().mockReturnValue({ maybeSingle: verifyMaybeSingle })

  // --- client.rpc — handles claim + release RPCs ---
  const rpc = vi.fn((name: string, args: { p_owner?: string; p_limit?: number }) => {
    if (name === 'claim_articles_for_embedding') {
      if (fetchError) return Promise.resolve({ data: null, error: fetchError })
      const all = (articles ?? []) as MockArticleRow[]
      const now = Date.now()
      const claimable = all.filter((a) => {
        const claimedAt = a.embedding_claimed_at ?? null
        if (!claimedAt) return true
        const claimedMs = new Date(claimedAt).getTime()
        return Number.isNaN(claimedMs) || now - claimedMs >= CLAIM_TTL_MS
      })
      const limit = args.p_limit ?? claimable.length
      return Promise.resolve({ data: claimable.slice(0, limit).map((a) => a.id), error: null })
    }
    if (name === 'release_embedding_claim') {
      return Promise.resolve({ data: true, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  // --- select('id, title, description, title_fingerprint, embedding_retry_count').in('id', ids) path ---
  const fetchByIdsIn = vi.fn((_col: string, ids: string[]) => {
    const all = (articles ?? []) as MockArticleRow[]
    const bySet = new Set(ids)
    const rows = all.filter((a) => bySet.has(a.id)).map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      title_fingerprint: a.title_fingerprint,
      embedding_retry_count: a.embedding_retry_count ?? 0,
    }))
    return Promise.resolve({ data: rows, error: null })
  })

  // --- select('title_fingerprint, title, description, embedding').in().eq().not() path ---
  const cacheNot = vi.fn().mockResolvedValue({ data: cacheRows, error: cacheError })
  const cacheEq = vi.fn().mockReturnValue({ not: cacheNot })
  const cacheIn = vi.fn().mockReturnValue({ eq: cacheEq })

  const select = vi.fn((fields: string) => {
    if (fields === 'title_fingerprint, title, description, embedding') {
      return { in: cacheIn }
    }
    if (fields === 'id, title, description, title_fingerprint, embedding_retry_count') {
      return { in: fetchByIdsIn }
    }
    if (fields === 'id, title, description, title_fingerprint') {
      return { in: fetchByIdsIn }
    }
    if (fields === 'embedding_claim_owner') {
      return { eq: verifyEq }
    }
    return { in: fetchByIdsIn }
  })

  // --- insert path (used by pushToDeadLetter) ---
  const insert = vi.fn().mockResolvedValue({ error: null })

  return {
    from: vi.fn(() => ({
      select,
      update,
      insert,
    })),
    rpc,
    _update: update,
    _insert: insert,
    _cacheIn: cacheIn,
    _rpc: rpc,
    _fetchByIdsIn: fetchByIdsIn,
  }
}

// --- Phase 10: mock client where owner-scoped update matches zero rows
//     and the verify-read shows a different claim owner. Used for
//     stale-worker race tests. ---
function createMockClientWithOwnershipMoved(
  articles: MockArticleRow[],
  takeoverOwner: string
) {
  // Update chain: .update(payload, { count: 'exact' }).eq('id').eq('embedding_claim_owner', owner)
  //   returns { error: null, count: 0 } on every call
  const ownerEq = vi.fn().mockResolvedValue({ error: null, count: 0 })
  const idEq = vi.fn().mockReturnValue({ eq: ownerEq })
  const update = vi.fn().mockReturnValue({ eq: idEq })

  // Verify-read chain: .select('embedding_claim_owner').eq('id').maybeSingle()
  //   returns the takeover owner, telling the helper "ownership moved"
  const verifyMaybeSingle = vi.fn().mockResolvedValue({
    data: { embedding_claim_owner: takeoverOwner },
    error: null,
  })
  const verifyEq = vi.fn().mockReturnValue({ maybeSingle: verifyMaybeSingle })

  // Claimed article fetch still needs to work for embedUnembeddedArticles.
  const fetchByIdsIn = vi.fn((_col: string, ids: string[]) => {
    const bySet = new Set(ids)
    const rows = (articles ?? [])
      .filter((a) => bySet.has(a.id))
      .map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        title_fingerprint: a.title_fingerprint,
        embedding_retry_count: a.embedding_retry_count ?? 0,
      }))
    return Promise.resolve({ data: rows, error: null })
  })

  // Cache lookup returns empty.
  const cacheNot = vi.fn().mockResolvedValue({ data: [], error: null })
  const cacheEq2 = vi.fn().mockReturnValue({ not: cacheNot })
  const cacheIn = vi.fn().mockReturnValue({ eq: cacheEq2 })

  const select = vi.fn((fields: string) => {
    if (fields === 'embedding_claim_owner') {
      return { eq: verifyEq }
    }
    if (fields === 'title_fingerprint, title, description, embedding') {
      return { in: cacheIn }
    }
    if (
      fields === 'id, title, description, title_fingerprint, embedding_retry_count'
    ) {
      return { in: fetchByIdsIn }
    }
    return { in: fetchByIdsIn }
  })

  const rpc = vi.fn(
    (name: string, args: { p_owner?: string; p_limit?: number }) => {
      if (name === 'claim_articles_for_embedding') {
        const limit = args.p_limit ?? articles.length
        return Promise.resolve({
          data: articles.slice(0, limit).map((a) => a.id),
          error: null,
        })
      }
      if (name === 'release_embedding_claim') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }
  )

  const insert = vi.fn().mockResolvedValue({ error: null })

  return {
    from: vi.fn(() => ({ select, update, insert })),
    rpc,
    _update: update,
    _insert: insert,
    _rpc: rpc,
  }
}

describe('embedUnembeddedArticles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('processes a claimed chunk of unembedded articles and clears claim timestamps', async () => {
    mockGenerateEmbeddingBatch.mockResolvedValue([
      { embedding: [0.1, 0.2] },
      { embedding: [0.3, 0.4] },
    ] as never)

    const client = createMockClient([
      { id: 'a1', title: 'First', description: 'One', title_fingerprint: null },
      { id: 'a2', title: 'Second', description: 'Two', title_fingerprint: null },
    ])

    const result = await embedUnembeddedArticles(client as never, 2)

    expect(client._rpc).toHaveBeenCalledWith(
      'claim_articles_for_embedding',
      expect.objectContaining({ p_limit: 2 })
    )
    expect(result.totalProcessed).toBe(2)
    expect(result.claimedArticles).toBe(2)
    expect(result.cacheHits).toBe(0)
    expect(result.errors).toEqual([])
    // Writes are owner-scoped per-row updates (no batch upsert — see
    // Phase 10 claim-safety audit).
    expect(client._update).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: [0.1, 0.2],
        is_embedded: true,
        embedding_claimed_at: null,
        embedding_claim_owner: null,
      }),
      { count: 'exact' }
    )
    expect(client._update).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: [0.3, 0.4],
        is_embedded: true,
        embedding_claimed_at: null,
        embedding_claim_owner: null,
      }),
      { count: 'exact' }
    )
  })

  it('returns zero when there are no unembedded articles', async () => {
    const client = createMockClient([])

    const result = await embedUnembeddedArticles(client as never, 10)

    expect(result).toEqual(expect.objectContaining({
      totalProcessed: 0,
      claimedArticles: 0,
      cacheHits: 0,
      errors: [],
    }))
  })

  it('skips freshly claimed articles but processes unclaimed and stale claims', async () => {
    mockGenerateEmbeddingBatch.mockResolvedValue([
      { embedding: [0.1, 0.2] },
      { embedding: [0.3, 0.4] },
    ] as never)

    const client = createMockClient([
      {
        id: 'a1',
        title: 'First',
        description: 'One',
        title_fingerprint: null,
        embedding_claimed_at: null,
      },
      {
        id: 'a2',
        title: 'Second',
        description: 'Two',
        title_fingerprint: null,
        embedding_claimed_at: '2026-03-22T11:20:00Z',
      },
      {
        id: 'a3',
        title: 'Fresh Claim',
        description: 'Three',
        title_fingerprint: null,
        embedding_claimed_at: '2026-03-22T11:50:00Z',
      },
    ])

    const result = await embedUnembeddedArticles(client as never, 3)

    expect(result.totalProcessed).toBe(2)
    expect(result.claimedArticles).toBe(2)
    expect(result.cacheHits).toBe(0)
    expect(mockGenerateEmbeddingBatch).toHaveBeenCalledWith(['First — One', 'Second — Two'])
  })

  it('clears claims and records an error when a batch embedding request fails', async () => {
    mockGenerateEmbeddingBatch.mockRejectedValue(new Error('provider unavailable'))

    const client = createMockClient([
      {
        id: 'a1',
        title: 'First',
        description: 'One',
        title_fingerprint: null,
        embedding_claimed_at: null,
      },
      {
        id: 'a2',
        title: 'Second',
        description: 'Two',
        title_fingerprint: null,
        embedding_claimed_at: null,
      },
    ])

    const result = await embedUnembeddedArticles(client as never, 2)

    expect(result).toEqual(expect.objectContaining({
      totalProcessed: 0,
      claimedArticles: 2,
      cacheHits: 0,
      errors: ['Batch embedding failed: provider unavailable'],
      modelTimeMs: 0,
    }))
    // Failure path updates retry metadata (count, next_attempt, last_error)
    // and clears the claim so the next run can pick it up after backoff.
    expect(client._update).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding_retry_count: 1,
        embedding_last_error: 'provider unavailable',
        embedding_claimed_at: null,
        embedding_claim_owner: null,
      }),
      { count: 'exact' }
    )
  })

  it('uses cached embeddings when fingerprint AND description match', async () => {
    mockGenerateEmbeddingBatch.mockResolvedValue([
      { embedding: [0.5, 0.6] },
    ] as never)

    const cachedEmbedding = [0.1, 0.2, 0.3]
    const client = createMockClient(
      [
        {
          id: 'a1',
          title: 'Wire Story',
          description: 'AP wire',
          title_fingerprint: 'fp-abc',
          embedding_claimed_at: null,
        },
        {
          id: 'a2',
          title: 'Unique Story',
          description: 'Original',
          title_fingerprint: 'fp-xyz',
          embedding_claimed_at: null,
        },
      ],
      null,
      null,
      [{ title_fingerprint: 'fp-abc', title: 'Wire Story', description: 'AP wire', embedding: cachedEmbedding }]
    )

    const result = await embedUnembeddedArticles(client as never, 2)

    expect(result.totalProcessed).toBe(2)
    expect(result.cacheHits).toBe(1)
    expect(mockGenerateEmbeddingBatch).toHaveBeenCalledWith(['Unique Story — Original'])
  })

  it('rejects cache hit when fingerprint matches but description differs', async () => {
    mockGenerateEmbeddingBatch.mockResolvedValue([
      { embedding: [0.5, 0.6] },
    ] as never)

    const client = createMockClient(
      [
        {
          id: 'a1',
          title: 'Wire Story',
          description: 'Updated description',
          title_fingerprint: 'fp-abc',
          embedding_claimed_at: null,
        },
      ],
      null,
      null,
      [{ title_fingerprint: 'fp-abc', title: 'Wire Story', description: 'Original description', embedding: [0.1, 0.2] }]
    )

    const result = await embedUnembeddedArticles(client as never, 1)

    expect(result.totalProcessed).toBe(1)
    expect(result.cacheHits).toBe(0)
    expect(mockGenerateEmbeddingBatch).toHaveBeenCalledWith(['Wire Story — Updated description'])
  })

  it('skips Gemini entirely when all articles have exact cache matches', async () => {
    const cachedEmbedding = [0.1, 0.2, 0.3]
    const client = createMockClient(
      [
        {
          id: 'a1',
          title: 'Wire Story',
          description: 'AP',
          title_fingerprint: 'fp-abc',
          embedding_claimed_at: null,
        },
        {
          id: 'a2',
          title: 'Wire Story',
          description: 'AP',
          title_fingerprint: 'fp-abc',
          embedding_claimed_at: null,
        },
      ],
      null,
      null,
      [{ title_fingerprint: 'fp-abc', title: 'Wire Story', description: 'AP', embedding: cachedEmbedding }]
    )

    const result = await embedUnembeddedArticles(client as never, 2)

    expect(result.totalProcessed).toBe(2)
    expect(result.cacheHits).toBe(2)
    expect(mockGenerateEmbeddingBatch).not.toHaveBeenCalled()
  })

  it('handles mixed batch with some cache hits and some misses', async () => {
    mockGenerateEmbeddingBatch.mockResolvedValue([
      { embedding: [0.7, 0.8] },
      { embedding: [0.9, 1.0] },
    ] as never)

    const client = createMockClient(
      [
        {
          id: 'a1',
          title: 'Cached',
          description: 'Cached desc',
          title_fingerprint: 'fp-cached',
          embedding_claimed_at: null,
        },
        {
          id: 'a2',
          title: 'No fingerprint',
          description: 'Desc',
          title_fingerprint: null,
          embedding_claimed_at: null,
        },
        {
          id: 'a3',
          title: 'Uncached',
          description: 'Uncached desc',
          title_fingerprint: 'fp-miss',
          embedding_claimed_at: null,
        },
      ],
      null,
      null,
      [{ title_fingerprint: 'fp-cached', title: 'Cached', description: 'Cached desc', embedding: [0.1, 0.2] }]
    )

    const result = await embedUnembeddedArticles(client as never, 3)

    expect(result.cacheHits).toBe(1)
    expect(result.totalProcessed).toBe(3)
    expect(mockGenerateEmbeddingBatch).toHaveBeenCalledTimes(1)
    expect(mockGenerateEmbeddingBatch).toHaveBeenCalledWith([
      'No fingerprint — Desc',
      'Uncached — Uncached desc',
    ])
  })

  it('surfaces cache lookup errors in the result instead of swallowing them', async () => {
    mockGenerateEmbeddingBatch.mockResolvedValue([
      { embedding: [0.1, 0.2] },
    ] as never)

    const client = createMockClient(
      [
        {
          id: 'a1',
          title: 'Story',
          description: 'Desc',
          title_fingerprint: 'fp-x',
          embedding_claimed_at: null,
        },
      ],
      null,
      null,
      [],
      { message: 'index missing' }
    )

    const result = await embedUnembeddedArticles(client as never, 1)

    expect(result.totalProcessed).toBe(1)
    expect(result.cacheHits).toBe(0)
    expect(result.errors).toEqual(['Embedding cache lookup failed: index missing'])
    expect(mockGenerateEmbeddingBatch).toHaveBeenCalledTimes(1)
  })

  it('emits dlq_pushed when retry budget is exhausted', async () => {
    mockGenerateEmbeddingBatch.mockRejectedValue(new Error('provider unavailable'))

    const client = createMockClient([
      {
        id: 'a1',
        title: 'First',
        description: 'One',
        title_fingerprint: null,
        embedding_claimed_at: null,
        // Already at the retry budget (5) — this failure exhausts.
        embedding_retry_count: 5,
      },
    ])

    const emitter = vi.fn().mockResolvedValue(undefined)

    const result = await embedUnembeddedArticles(client as never, 1, undefined, emitter)

    expect(result.totalProcessed).toBe(0)
    expect(emitter).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'embed',
        level: 'error',
        eventType: 'dlq_pushed',
        itemId: 'a1',
        payload: expect.objectContaining({
          articleId: 'a1',
          retryCount: 6,
          error: 'provider unavailable',
        }),
      })
    )
  })

  it('does NOT push DLQ when the failure update matches zero rows due to ownership move', async () => {
    mockGenerateEmbeddingBatch.mockRejectedValue(new Error('provider unavailable'))

    const articles: MockArticleRow[] = [
      {
        id: 'a1',
        title: 'Title',
        description: 'Desc',
        title_fingerprint: null,
        embedding_claimed_at: null,
        embedding_retry_count: 5, // at budget — would normally exhaust + DLQ
      },
    ]
    const client = createMockClientWithOwnershipMoved(articles, 'other-owner')

    const emitter = vi.fn().mockResolvedValue(undefined)
    await embedUnembeddedArticles(client as never, 1, 'stale-owner', emitter)

    // DLQ push must NOT happen for an article no longer owned by us.
    expect(client._insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ item_kind: 'article_embed' })
    )
    // Ownership-moved diagnostic emitted at info level.
    expect(emitter).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'embed',
        level: 'info',
        eventType: 'ownership_moved',
        itemId: 'a1',
      })
    )
  })

  it('does NOT count a write as processed when ownership moved between claim and write', async () => {
    mockGenerateEmbeddingBatch.mockResolvedValue([{ embedding: [0.1, 0.2] }] as never)

    const articles: MockArticleRow[] = [
      {
        id: 'a1',
        title: 'T',
        description: 'D',
        title_fingerprint: null,
        embedding_claimed_at: null,
      },
    ]
    const client = createMockClientWithOwnershipMoved(articles, 'other-owner')

    const emitter = vi.fn().mockResolvedValue(undefined)
    const result = await embedUnembeddedArticles(
      client as never,
      1,
      'stale-owner',
      emitter
    )

    expect(result.totalProcessed).toBe(0)
    expect(emitter).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'embed',
        eventType: 'ownership_moved',
      })
    )
  })
})
