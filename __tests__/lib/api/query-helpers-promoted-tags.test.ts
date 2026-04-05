import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { queryPromotedTags, PROMOTED_TAG_THRESHOLD, PROMOTED_TAG_LIMIT } from '@/lib/api/query-helpers'

function createMockQueryBuilder(data: unknown = [], error: null | { message: string } = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      resolve({ data, error })
      return Promise.resolve({ data, error })
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

const mockTags = [
  { id: 't1', slug: 'donald-trump', label: 'Donald Trump', description: null, tag_type: 'person', story_count: 47, created_at: '2026-01-01T00:00:00Z' },
  { id: 't2', slug: 'nato', label: 'NATO', description: null, tag_type: 'organization', story_count: 23, created_at: '2026-01-01T00:00:00Z' },
  { id: 't3', slug: 'ai-regulation', label: 'AI Regulation', description: null, tag_type: 'topic', story_count: 18, created_at: '2026-01-01T00:00:00Z' },
]

describe('queryPromotedTags', () => {
  it('returns tags with story_count >= default threshold', async () => {
    const builder = createMockQueryBuilder(mockTags)
    const client = createMockClient(builder)

    const result = await queryPromotedTags(client)

    expect(client.from).toHaveBeenCalledWith('tags')
    expect(builder.select).toHaveBeenCalledWith('id, slug, label, description, tag_type, story_count, created_at')
    expect(builder.gte).toHaveBeenCalledWith('story_count', PROMOTED_TAG_THRESHOLD)
    expect(builder.order).toHaveBeenCalledWith('story_count', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(PROMOTED_TAG_LIMIT)
    expect(result).toEqual(mockTags)
  })

  it('uses custom threshold and limit when provided', async () => {
    const builder = createMockQueryBuilder([mockTags[0]])
    const client = createMockClient(builder)

    await queryPromotedTags(client, { threshold: 10, limit: 5 })

    expect(builder.gte).toHaveBeenCalledWith('story_count', 10)
    expect(builder.limit).toHaveBeenCalledWith(5)
  })

  it('returns empty array when no tags meet threshold', async () => {
    const builder = createMockQueryBuilder([])
    const client = createMockClient(builder)

    const result = await queryPromotedTags(client)

    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    const builder = createMockQueryBuilder(null)
    const client = createMockClient(builder)

    const result = await queryPromotedTags(client)

    expect(result).toEqual([])
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, { message: 'DB connection failed' })
    const client = createMockClient(builder)

    await expect(queryPromotedTags(client)).rejects.toThrow('Failed to query promoted tags: DB connection failed')
  })

  it('exports correct default constants', () => {
    expect(PROMOTED_TAG_THRESHOLD).toBe(3)
    expect(PROMOTED_TAG_LIMIT).toBe(15)
  })
})
