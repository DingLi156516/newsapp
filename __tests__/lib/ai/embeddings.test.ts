import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/gemini-client', () => ({
  generateEmbeddingBatch: vi.fn(),
}))

import { embedUnembeddedArticles } from '@/lib/ai/embeddings'
import { generateEmbeddingBatch } from '@/lib/ai/gemini-client'

const mockGenerateEmbeddingBatch = vi.mocked(generateEmbeddingBatch)

function createMockClient(articles: unknown[] | null, fetchError: unknown = null, updateError: unknown = null) {
  const updateEq = vi.fn().mockResolvedValue({ error: updateError })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const returns = vi.fn().mockResolvedValue({ data: articles, error: fetchError })
  const limit = vi.fn().mockReturnValue({ returns })
  const order = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit }) })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })

  return {
    from: vi.fn(() => ({
      select,
      update,
    })),
    _update: update,
    _selectEq: eq,
    _limit: limit,
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
      { id: 'a1', title: 'First', description: 'One' },
      { id: 'a2', title: 'Second', description: 'Two' },
    ])

    const result = await embedUnembeddedArticles(client as never, 2)

    expect(client._selectEq).toHaveBeenCalledWith('is_embedded', false)
    expect(client._limit).toHaveBeenCalledWith(6)
    expect(result.totalProcessed).toBe(2)
    expect(result.claimedArticles).toBe(2)
    expect(result.errors).toEqual([])
    expect(client._update).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding_claimed_at: expect.any(String),
      })
    )
    expect(client._update).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: [0.1, 0.2],
        is_embedded: true,
        embedding_claimed_at: null,
      })
    )
  })

  it('returns zero when there are no unembedded articles', async () => {
    const client = createMockClient([])

    const result = await embedUnembeddedArticles(client as never, 10)

    expect(result).toEqual({
      totalProcessed: 0,
      claimedArticles: 0,
      errors: [],
    })
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
        embedding_claimed_at: null,
      },
      {
        id: 'a2',
        title: 'Second',
        description: 'Two',
        embedding_claimed_at: '2026-03-22T11:20:00Z',
      },
      {
        id: 'a3',
        title: 'Fresh Claim',
        description: 'Three',
        embedding_claimed_at: '2026-03-22T11:50:00Z',
      },
    ])

    const result = await embedUnembeddedArticles(client as never, 3)

    expect(result.totalProcessed).toBe(2)
    expect(result.claimedArticles).toBe(2)
    expect(mockGenerateEmbeddingBatch).toHaveBeenCalledWith(['First — One', 'Second — Two'])
  })
})
