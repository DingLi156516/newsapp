import { describe, it, expect, vi } from 'vitest'
import { queryBookmarks, insertBookmark, deleteBookmark } from '@/lib/api/bookmark-queries'

function createMockClient(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  }

  return {
    from: vi.fn(() => chainable),
    _chain: chainable,
  }
}

describe('queryBookmarks', () => {
  it('returns story IDs for user', async () => {
    const mockClient = createMockClient()
    mockClient._chain.order.mockResolvedValue({
      data: [{ story_id: 'id-1' }, { story_id: 'id-2' }],
      error: null,
    })

    const result = await queryBookmarks(mockClient as any, 'user-1')
    expect(result.storyIds).toEqual(['id-1', 'id-2'])
    expect(mockClient.from).toHaveBeenCalledWith('bookmarks')
  })

  it('returns empty array when no bookmarks', async () => {
    const mockClient = createMockClient()
    mockClient._chain.order.mockResolvedValue({ data: [], error: null })

    const result = await queryBookmarks(mockClient as any, 'user-1')
    expect(result.storyIds).toEqual([])
  })

  it('throws on query error', async () => {
    const mockClient = createMockClient()
    mockClient._chain.order.mockResolvedValue({
      data: null,
      error: { message: 'Query failed' },
    })

    await expect(queryBookmarks(mockClient as any, 'user-1')).rejects.toThrow(
      'Failed to query bookmarks: Query failed'
    )
  })
})

describe('insertBookmark', () => {
  it('calls upsert with correct params', async () => {
    const mockClient = createMockClient()
    mockClient._chain.upsert.mockResolvedValue({ error: null })

    await insertBookmark(mockClient as any, 'user-1', 'story-1')
    expect(mockClient.from).toHaveBeenCalledWith('bookmarks')
    expect(mockClient._chain.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', story_id: 'story-1' },
      { onConflict: 'user_id,story_id' }
    )
  })

  it('throws on insert error', async () => {
    const mockClient = createMockClient()
    mockClient._chain.upsert.mockResolvedValue({
      error: { message: 'Insert failed' },
    })

    await expect(insertBookmark(mockClient as any, 'user-1', 'story-1')).rejects.toThrow(
      'Failed to add bookmark: Insert failed'
    )
  })
})

describe('deleteBookmark', () => {
  it('calls delete with correct filters', async () => {
    const mockClient = createMockClient()
    mockClient._chain.eq.mockReturnThis()
    // The second .eq() call should resolve
    let eqCallCount = 0
    mockClient._chain.eq.mockImplementation(() => {
      eqCallCount++
      if (eqCallCount >= 2) {
        return Promise.resolve({ error: null })
      }
      return mockClient._chain
    })

    await deleteBookmark(mockClient as any, 'user-1', 'story-1')
    expect(mockClient.from).toHaveBeenCalledWith('bookmarks')
  })

  it('throws on delete error', async () => {
    const mockClient = createMockClient()
    let eqCallCount = 0
    mockClient._chain.eq.mockImplementation(() => {
      eqCallCount++
      if (eqCallCount >= 2) {
        return Promise.resolve({ error: { message: 'Delete failed' } })
      }
      return mockClient._chain
    })

    await expect(deleteBookmark(mockClient as any, 'user-1', 'story-1')).rejects.toThrow(
      'Failed to remove bookmark: Delete failed'
    )
  })
})
