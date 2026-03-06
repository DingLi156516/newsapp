import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  queryReviewQueue,
  updateReviewStatus,
  queryReviewStats,
} from '@/lib/api/review-queries'

function createMockQueryBuilder(
  data: unknown = [],
  count: number = 0,
  error: null | { message: string } = null
) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      resolve({ data, count, error })
      return Promise.resolve({ data, count, error })
    }),
  }
  Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' })
  return builder
}

function createMockClient(queryBuilder: ReturnType<typeof createMockQueryBuilder>) {
  return {
    from: vi.fn().mockReturnValue(queryBuilder),
  } as unknown as SupabaseClient<Database>
}

const mockStory = {
  id: 'story-1',
  headline: 'Test Story',
  topic: 'politics',
  region: 'us',
  source_count: 3,
  is_blindspot: false,
  image_url: null,
  factuality: 'high',
  ownership: 'corporate',
  spectrum_segments: [],
  ai_summary: { commonGround: '', leftFraming: '', rightFraming: '' },
  review_status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  first_published: '2024-01-01T00:00:00Z',
  last_updated: '2024-01-01T00:00:00Z',
}

describe('queryReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns stories with count', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    const result = await queryReviewQueue(client, { page: 1, limit: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.count).toBe(1)
  })

  it('applies status filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryReviewQueue(client, { status: 'pending', page: 1, limit: 20 })

    expect(builder.eq).toHaveBeenCalledWith('review_status', 'pending')
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(
      queryReviewQueue(client, { page: 1, limit: 20 })
    ).rejects.toThrow('Failed to query review queue')
  })

  it('paginates correctly', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    await queryReviewQueue(client, { page: 3, limit: 10 })

    expect(builder.range).toHaveBeenCalledWith(20, 29)
  })
})

describe('updateReviewStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approves a story', async () => {
    const builder = createMockQueryBuilder(mockStory)
    const client = createMockClient(builder)

    await updateReviewStatus(client, 'story-1', 'admin-user-id', {
      action: 'approve',
    })

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: 'approved',
        reviewed_by: 'admin-user-id',
      })
    )
    expect(builder.eq).toHaveBeenCalledWith('id', 'story-1')
  })

  it('approves with headline and summary edits', async () => {
    const builder = createMockQueryBuilder(mockStory)
    const client = createMockClient(builder)

    await updateReviewStatus(client, 'story-1', 'admin-user-id', {
      action: 'approve',
      headline: 'Edited Headline',
      ai_summary: {
        commonGround: 'Edited CG',
        leftFraming: 'Edited LF',
        rightFraming: 'Edited RF',
      },
    })

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: 'approved',
        headline: 'Edited Headline',
        ai_summary: expect.objectContaining({
          commonGround: 'Edited CG',
        }),
      })
    )
  })

  it('rejects a story', async () => {
    const builder = createMockQueryBuilder(mockStory)
    const client = createMockClient(builder)

    await updateReviewStatus(client, 'story-1', 'admin-user-id', {
      action: 'reject',
    })

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: 'rejected',
        reviewed_by: 'admin-user-id',
      })
    )
  })

  it('reprocesses a story by resetting to pending', async () => {
    const builder = createMockQueryBuilder(mockStory)
    const client = createMockClient(builder)

    await updateReviewStatus(client, 'story-1', 'admin-user-id', {
      action: 'reprocess',
    })

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: 'pending',
        headline: 'Pending headline generation',
      })
    )
  })

  it('throws on update error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'Update failed' })
    const client = createMockClient(builder)

    await expect(
      updateReviewStatus(client, 'story-1', 'admin-user-id', { action: 'approve' })
    ).rejects.toThrow('Failed to update review status')
  })
})

describe('queryReviewStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns counts by status', async () => {
    const client = {
      from: vi.fn().mockImplementation(() => {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
            resolve({ count: 5, error: null })
            return Promise.resolve({ count: 5, error: null })
          }),
        }
        Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' })
        return builder
      }),
    } as unknown as SupabaseClient<Database>

    const stats = await queryReviewStats(client)

    expect(stats).toEqual({
      pending: 5,
      approved: 5,
      rejected: 5,
    })
  })

  it('throws on query error', async () => {
    const client = {
      from: vi.fn().mockImplementation(() => {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
            resolve({ count: null, error: { message: 'DB error' } })
            return Promise.resolve({ count: null, error: { message: 'DB error' } })
          }),
        }
        Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' })
        return builder
      }),
    } as unknown as SupabaseClient<Database>

    await expect(queryReviewStats(client)).rejects.toThrow('Failed to query review stats')
  })
})
