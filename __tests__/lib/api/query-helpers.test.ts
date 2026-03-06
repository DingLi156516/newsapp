import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { queryStories, queryStoryById, querySourcesForStory, querySources, queryArticlesWithSourcesForStory } from '@/lib/api/query-helpers'

function createMockQueryBuilder(data: unknown = [], count: number = 0, error: null | { message: string; code?: string } = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      resolve({ data, count, error })
      return Promise.resolve({ data, count, error })
    }),
  }
  // Make it thenable (awaitable)
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
  ai_summary: {},
  first_published: '2024-01-01T00:00:00Z',
  last_updated: '2024-01-01T00:00:00Z',
}

describe('queryStories', () => {
  it('returns stories with count', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    const result = await queryStories(client, {
      page: 1,
      limit: 20,
    })

    expect(result.data).toHaveLength(1)
    expect(result.count).toBe(1)
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(
      queryStories(client, { page: 1, limit: 20 })
    ).rejects.toThrow('Failed to query stories')
  })

  it('applies topic filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      topic: 'technology',
      page: 1,
      limit: 20,
    })

    expect(builder.eq).toHaveBeenCalledWith('topic', 'technology')
  })

  it('applies blindspot filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      blindspot: 'true',
      page: 1,
      limit: 20,
    })

    expect(builder.eq).toHaveBeenCalledWith('is_blindspot', true)
  })

  it('applies search filter using textSearch', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      search: 'AI regulation',
      page: 1,
      limit: 20,
    })

    expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'AI regulation', { type: 'websearch' })
    expect(builder.ilike).not.toHaveBeenCalled()
  })

  it('applies minFactuality filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      minFactuality: 'high',
      page: 1,
      limit: 20,
    })

    expect(builder.in).toHaveBeenCalledWith('factuality', ['high', 'very-high'])
  })

  it('applies datePreset filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      datePreset: '7d',
      page: 1,
      limit: 20,
    })

    expect(builder.gte).toHaveBeenCalledWith('first_published', expect.any(String))
  })

  it('does not apply datePreset filter for "all"', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      datePreset: 'all',
      page: 1,
      limit: 20,
    })

    expect(builder.gte).not.toHaveBeenCalled()
  })

  it('applies biasRange filter client-side', async () => {
    const leftStory = {
      ...mockStory,
      id: 'story-left',
      spectrum_segments: [
        { bias: 'left', percentage: 60 },
        { bias: 'center', percentage: 40 },
      ],
    }
    const rightStory = {
      ...mockStory,
      id: 'story-right',
      spectrum_segments: [
        { bias: 'right', percentage: 70 },
        { bias: 'far-right', percentage: 30 },
      ],
    }
    const builder = createMockQueryBuilder([leftStory, rightStory], 2)
    const client = createMockClient(builder)

    const result = await queryStories(client, {
      biasRange: 'left,center',
      page: 1,
      limit: 20,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('story-left')
  })

  it('does not filter biasRange when all 7 biases selected', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    const result = await queryStories(client, {
      biasRange: 'far-left,left,lean-left,center,lean-right,right,far-right',
      page: 1,
      limit: 20,
    })

    expect(result.data).toHaveLength(1)
  })

})

describe('queryStoryById', () => {
  it('returns story when found', async () => {
    const builder = createMockQueryBuilder(mockStory, 0)
    const client = createMockClient(builder)

    const result = await queryStoryById(client, 'story-1')
    expect(result).toEqual(mockStory)
  })

  it('returns null for not found', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'Not found', code: 'PGRST116' })
    const client = createMockClient(builder)

    const result = await queryStoryById(client, 'nonexistent')
    expect(result).toBeNull()
  })

  it('throws on other errors', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB crash' })
    const client = createMockClient(builder)

    await expect(queryStoryById(client, 'story-1')).rejects.toThrow('Failed to fetch story')
  })
})

describe('querySourcesForStory', () => {
  it('returns empty array when no articles', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    const result = await querySourcesForStory(client, 'story-1')
    expect(result).toEqual([])
  })

  it('throws on article fetch error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'Article error' })
    const client = createMockClient(builder)

    await expect(querySourcesForStory(client, 'story-1')).rejects.toThrow('Failed to fetch articles')
  })
})

describe('querySources', () => {
  it('returns sources with count', async () => {
    const source = { id: 'src-1', name: 'Test', bias: 'center' }
    const builder = createMockQueryBuilder([source], 1)
    const client = createMockClient(builder)

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.data).toHaveLength(1)
    expect(result.count).toBe(1)
  })

  it('applies bias filter', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    await querySources(client, { bias: 'left', page: 1, limit: 50 })
    expect(builder.eq).toHaveBeenCalledWith('bias', 'left')
  })

  it('throws on error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'Source error' })
    const client = createMockClient(builder)

    await expect(
      querySources(client, { page: 1, limit: 50 })
    ).rejects.toThrow('Failed to query sources')
  })
})

describe('queryArticlesWithSourcesForStory', () => {
  it('returns empty array when no articles', async () => {
    const builder = createMockQueryBuilder([])
    const client = createMockClient(builder)

    const result = await queryArticlesWithSourcesForStory(client, 'story-1')
    expect(result).toEqual([])
  })

  it('returns flattened article-source records', async () => {
    const mockArticles = [
      {
        id: 'art-1',
        title: 'Test Article',
        published_at: '2026-03-01T10:00:00Z',
        source_id: 'src-1',
        sources: { name: 'Reuters', bias: 'center', factuality: 'very-high' },
      },
    ]
    const builder = createMockQueryBuilder(mockArticles)
    const client = createMockClient(builder)

    const result = await queryArticlesWithSourcesForStory(client, 'story-1')
    expect(result).toHaveLength(1)
    expect(result[0].source_name).toBe('Reuters')
    expect(result[0].source_bias).toBe('center')
  })

  it('filters out articles with null sources', async () => {
    const mockArticles = [
      {
        id: 'art-1',
        title: 'Good Article',
        published_at: '2026-03-01T10:00:00Z',
        source_id: 'src-1',
        sources: { name: 'Reuters', bias: 'center', factuality: 'very-high' },
      },
      {
        id: 'art-2',
        title: 'Bad Article',
        published_at: '2026-03-01T11:00:00Z',
        source_id: 'src-2',
        sources: null,
      },
    ]
    const builder = createMockQueryBuilder(mockArticles)
    const client = createMockClient(builder)

    const result = await queryArticlesWithSourcesForStory(client, 'story-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('art-1')
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(
      queryArticlesWithSourcesForStory(client, 'story-1')
    ).rejects.toThrow('Failed to fetch articles for timeline')
  })
})
