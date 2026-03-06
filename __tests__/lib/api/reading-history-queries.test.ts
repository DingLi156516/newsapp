/**
 * Tests for lib/api/reading-history-queries.ts
 */

import { describe, it, expect, vi } from 'vitest'
import {
  queryReadingHistory,
  queryReadStoryIds,
  upsertReadingHistory,
  markAsUnread,
} from '@/lib/api/reading-history-queries'

function createMockClient(overrides: Record<string, unknown> = {}) {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    ...overrides,
  }

  return {
    from: vi.fn(() => chainable),
    _chain: chainable,
  }
}

describe('queryReadingHistory', () => {
  it('returns paginated reading history', async () => {
    const rows = [
      { id: '1', user_id: 'u1', story_id: 's1', read_at: '2026-01-01', is_read: true },
      { id: '2', user_id: 'u1', story_id: 's2', read_at: '2026-01-02', is_read: true },
    ]

    const mockClient = createMockClient()
    mockClient._chain.range.mockResolvedValue({ data: rows, count: 2, error: null })

    const result = await queryReadingHistory(mockClient as never, 'u1')
    expect(result.data).toEqual(rows)
    expect(result.count).toBe(2)
    expect(mockClient.from).toHaveBeenCalledWith('reading_history')
  })

  it('returns empty when no history', async () => {
    const mockClient = createMockClient()
    mockClient._chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    const result = await queryReadingHistory(mockClient as never, 'u1')
    expect(result.data).toEqual([])
    expect(result.count).toBe(0)
  })

  it('throws on query error', async () => {
    const mockClient = createMockClient()
    mockClient._chain.range.mockResolvedValue({
      data: null,
      count: null,
      error: { message: 'DB error' },
    })

    await expect(queryReadingHistory(mockClient as never, 'u1')).rejects.toThrow(
      'Failed to query reading history: DB error'
    )
  })
})

describe('queryReadStoryIds', () => {
  it('returns story IDs', async () => {
    const mockClient = createMockClient()
    // eq is called twice (user_id and is_read), second call resolves
    let eqCount = 0
    mockClient._chain.eq.mockImplementation(() => {
      eqCount++
      if (eqCount >= 2) {
        return Promise.resolve({
          data: [{ story_id: 's1' }, { story_id: 's2' }],
          error: null,
        })
      }
      return mockClient._chain
    })

    const result = await queryReadStoryIds(mockClient as never, 'u1')
    expect(result).toEqual(['s1', 's2'])
  })

  it('returns empty when no read stories', async () => {
    const mockClient = createMockClient()
    let eqCount = 0
    mockClient._chain.eq.mockImplementation(() => {
      eqCount++
      if (eqCount >= 2) {
        return Promise.resolve({ data: [], error: null })
      }
      return mockClient._chain
    })

    const result = await queryReadStoryIds(mockClient as never, 'u1')
    expect(result).toEqual([])
  })

  it('throws on query error', async () => {
    const mockClient = createMockClient()
    let eqCount = 0
    mockClient._chain.eq.mockImplementation(() => {
      eqCount++
      if (eqCount >= 2) {
        return Promise.resolve({ data: null, error: { message: 'Fail' } })
      }
      return mockClient._chain
    })

    await expect(queryReadStoryIds(mockClient as never, 'u1')).rejects.toThrow(
      'Failed to query read story IDs: Fail'
    )
  })
})

describe('upsertReadingHistory', () => {
  it('upserts successfully', async () => {
    const mockClient = createMockClient()
    mockClient._chain.upsert.mockResolvedValue({ error: null })

    await expect(upsertReadingHistory(mockClient as never, 'u1', 's1')).resolves.toBeUndefined()
    expect(mockClient.from).toHaveBeenCalledWith('reading_history')
  })

  it('throws on upsert error', async () => {
    const mockClient = createMockClient()
    mockClient._chain.upsert.mockResolvedValue({
      error: { message: 'Upsert failed' },
    })

    await expect(upsertReadingHistory(mockClient as never, 'u1', 's1')).rejects.toThrow(
      'Failed to mark story as read: Upsert failed'
    )
  })
})

describe('markAsUnread', () => {
  it('updates is_read to false', async () => {
    const mockClient = createMockClient()
    let eqCount = 0
    mockClient._chain.eq.mockImplementation(() => {
      eqCount++
      if (eqCount >= 2) {
        return Promise.resolve({ error: null })
      }
      return mockClient._chain
    })

    await expect(markAsUnread(mockClient as never, 'u1', 's1')).resolves.toBeUndefined()
    expect(mockClient.from).toHaveBeenCalledWith('reading_history')
  })

  it('throws on update error', async () => {
    const mockClient = createMockClient()
    let eqCount = 0
    mockClient._chain.eq.mockImplementation(() => {
      eqCount++
      if (eqCount >= 2) {
        return Promise.resolve({ error: { message: 'Update failed' } })
      }
      return mockClient._chain
    })

    await expect(markAsUnread(mockClient as never, 'u1', 's1')).rejects.toThrow(
      'Failed to mark story as unread: Update failed'
    )
  })
})
