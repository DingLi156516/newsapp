import {
  queryOwners,
  queryOwnerById,
  queryOwnerBySlug,
  queryRecentStoriesForOwner,
} from '@/lib/api/owner-queries'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

function mockChain(finalValue: { data: unknown; count?: number | null; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.range = vi.fn().mockResolvedValue(finalValue)
  chain.order = vi.fn(() => ({ range: chain.range }))
  chain.ilike = vi.fn(() => ({ order: chain.order }))
  chain.eq = vi.fn(() => ({ ilike: chain.ilike, order: chain.order, eq: chain.eq }))
  chain.select = vi.fn(() => ({ eq: chain.eq, ilike: chain.ilike, order: chain.order }))
  return chain
}

function mockClient(chain: Record<string, ReturnType<typeof vi.fn>>) {
  return { from: vi.fn(() => ({ select: chain.select })) } as unknown as SupabaseClient<Database>
}

const ownerRow = {
  id: 'owner-1',
  name: 'Fox Corporation',
  slug: 'fox-corporation',
  owner_type: 'public_company',
  is_individual: false,
  country: 'United States',
  wikidata_qid: 'Q186068',
  parent_owner_id: null,
  owner_source: 'wikidata',
  owner_verified_at: '2026-04-01T00:00:00Z',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
  source_count: 1,
}

describe('queryOwners', () => {
  it('returns owners with source count', async () => {
    const chain = mockChain({ data: [ownerRow], count: 1, error: null })
    const client = mockClient(chain)

    const result = await queryOwners(client, { page: 1, limit: 50 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Fox Corporation')
    expect(result.count).toBe(1)
  })

  it('applies search filter via ilike', async () => {
    const chain = mockChain({ data: [], count: 0, error: null })
    const client = mockClient(chain)

    await queryOwners(client, { search: 'Fox', page: 1, limit: 50 })

    expect(chain.ilike).toHaveBeenCalledWith('name', '%Fox%')
  })

  it('applies owner_type filter via eq', async () => {
    const chain = mockChain({ data: [], count: 0, error: null })
    const client = mockClient(chain)

    await queryOwners(client, { owner_type: 'trust', page: 1, limit: 50 })

    expect(chain.eq).toHaveBeenCalledWith('owner_type', 'trust')
  })

  it('throws on Supabase error', async () => {
    const chain = mockChain({ data: null, count: null, error: { message: 'DB error' } })
    const client = mockClient(chain)

    await expect(queryOwners(client, { page: 1, limit: 50 })).rejects.toThrow('Failed to query owners')
  })
})

describe('queryOwnerById', () => {
  it('returns owner with sources array', async () => {
    const sourceRow = {
      id: 'src-1',
      slug: 'fox-news',
      name: 'Fox News',
      bias: 'right',
      factuality: 'mixed',
      ownership: 'corporate',
      url: 'foxnews.com',
      region: 'us',
    }

    const singleMock = vi.fn().mockResolvedValue({ data: ownerRow, error: null })
    const eqOwner = vi.fn(() => ({ single: singleMock }))
    const selectOwner = vi.fn(() => ({ eq: eqOwner }))

    const eqActiveSource = vi.fn().mockResolvedValue({ data: [sourceRow], error: null })
    const eqOwnerIdSource = vi.fn(() => ({ eq: eqActiveSource }))
    const selectSources = vi.fn().mockReturnValue({
      eq: eqOwnerIdSource,
    })

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'media_owners') return { select: selectOwner }
        if (table === 'sources') return { select: selectSources }
        return {}
      }),
    } as unknown as SupabaseClient<Database>

    const result = await queryOwnerById(client, 'owner-1')

    expect(result).not.toBeNull()
    expect(result!.owner.name).toBe('Fox Corporation')
    expect(result!.sources).toHaveLength(1)
    expect(result!.sources[0].name).toBe('Fox News')
  })

  it('returns null when owner not found', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } })
    const eqOwner = vi.fn(() => ({ single: singleMock }))
    const selectOwner = vi.fn(() => ({ eq: eqOwner }))

    const client = {
      from: vi.fn(() => ({ select: selectOwner })),
    } as unknown as SupabaseClient<Database>

    const result = await queryOwnerById(client, 'nonexistent')

    expect(result).toBeNull()
  })
})

describe('queryOwnerBySlug', () => {
  it('returns owner with active sources', async () => {
    const sourceRow = {
      id: 'src-1',
      slug: 'fox-news',
      name: 'Fox News',
      bias: 'right',
      factuality: 'mixed',
      ownership: 'corporate',
      url: 'foxnews.com',
      region: 'us',
    }

    const singleMock = vi.fn().mockResolvedValue({ data: ownerRow, error: null })
    const eqSlug = vi.fn(() => ({ single: singleMock }))
    const selectOwner = vi.fn(() => ({ eq: eqSlug }))

    const orderSources = vi.fn().mockResolvedValue({ data: [sourceRow], error: null })
    const eqActive = vi.fn(() => ({ order: orderSources }))
    const eqOwnerIdSource = vi.fn(() => ({ eq: eqActive }))
    const selectSources = vi.fn().mockReturnValue({ eq: eqOwnerIdSource })

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'media_owners') return { select: selectOwner }
        if (table === 'sources') return { select: selectSources }
        return {}
      }),
    } as unknown as SupabaseClient<Database>

    const result = await queryOwnerBySlug(client, 'fox-corporation')

    expect(result).not.toBeNull()
    expect(result!.owner.slug).toBe('fox-corporation')
    expect(eqSlug).toHaveBeenCalledWith('slug', 'fox-corporation')
    expect(result!.sources).toHaveLength(1)
  })

  it('returns null when slug is unknown', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })
    const eqSlug = vi.fn(() => ({ single: singleMock }))
    const selectOwner = vi.fn(() => ({ eq: eqSlug }))

    const client = {
      from: vi.fn(() => ({ select: selectOwner })),
    } as unknown as SupabaseClient<Database>

    const result = await queryOwnerBySlug(client, 'nonexistent')

    expect(result).toBeNull()
  })

  it('throws on non-PGRST116 errors', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '500', message: 'boom' },
    })
    const eqSlug = vi.fn(() => ({ single: singleMock }))
    const selectOwner = vi.fn(() => ({ eq: eqSlug }))

    const client = {
      from: vi.fn(() => ({ select: selectOwner })),
    } as unknown as SupabaseClient<Database>

    await expect(queryOwnerBySlug(client, 'fox-corporation')).rejects.toThrow(
      'Failed to fetch owner'
    )
  })
})

describe('queryRecentStoriesForOwner', () => {
  function makeArticleRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      url: 'https://example.com/a',
      published_at: '2026-04-01T00:00:00Z',
      fetched_at: '2026-04-01T00:00:00Z',
      stories: {
        id: 'story-1',
        headline: 'Top Story',
        topic: 'politics',
        region: 'us',
        is_blindspot: false,
        first_published: '2026-04-01T00:00:00Z',
        last_updated: '2026-04-01T00:00:00Z',
        publication_status: 'published',
      },
      ...overrides,
    }
  }

  function makeClient(
    sourceRows: Array<{ id: string }> | null,
    sourceErr: unknown,
    articleRows: unknown[] | null,
    articleErr: unknown
  ) {
    // Chain two `.eq()` calls: owner_id then is_active. The second resolves.
    const eqActive = vi.fn().mockResolvedValue({ data: sourceRows, error: sourceErr })
    const selectSources = vi.fn(() => ({
      eq: vi.fn(() => ({ eq: eqActive })),
    }))

    // Chain: .or().order(published_at).order(fetched_at).order(id)
    const orderId = vi
      .fn()
      .mockResolvedValue({ data: articleRows, error: articleErr })
    const orderFetched = vi.fn(() => ({ order: orderId }))
    const orderPublished = vi.fn(() => ({ order: orderFetched }))
    const orOp = vi.fn(() => ({ order: orderPublished }))
    const notOp = vi.fn(() => ({ or: orOp }))
    const inOp = vi.fn(() => ({ not: notOp }))
    const selectArticles = vi.fn(() => ({ in: inOp }))

    return {
      from: vi.fn((table: string) => {
        if (table === 'sources') return { select: selectSources }
        if (table === 'articles') return { select: selectArticles }
        return {}
      }),
    } as unknown as SupabaseClient<Database>
  }

  it('returns empty when owner has no sources', async () => {
    const client = makeClient([], null, null, null)
    const result = await queryRecentStoriesForOwner(client, 'owner-1')
    expect(result).toEqual([])
  })

  it('throws on source query error', async () => {
    const client = makeClient(null, { message: 'boom' }, null, null)
    await expect(queryRecentStoriesForOwner(client, 'owner-1')).rejects.toThrow(
      'Failed to fetch sources for owner'
    )
  })

  it('throws on article query error', async () => {
    const client = makeClient([{ id: 's-1' }], null, null, { message: 'boom' })
    await expect(queryRecentStoriesForOwner(client, 'owner-1')).rejects.toThrow(
      'Failed to fetch recent stories for owner'
    )
  })

  it('deduplicates articles across sources into distinct stories', async () => {
    const rows = [
      makeArticleRow(),
      makeArticleRow(),
      makeArticleRow({
        stories: {
          id: 'story-2',
          headline: 'Another',
          topic: 'world',
          region: 'international',
          is_blindspot: true,
          first_published: '2026-03-30T00:00:00Z',
          last_updated: '2026-03-30T00:00:00Z',
          publication_status: 'published',
        },
      }),
    ]
    const client = makeClient([{ id: 's-1' }, { id: 's-2' }], null, rows, null)
    const result = await queryRecentStoriesForOwner(client, 'owner-1')
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.id).sort()).toEqual(['story-1', 'story-2'])
  })

  it('skips unpublished stories', async () => {
    const rows = [
      makeArticleRow({
        stories: {
          id: 'story-draft',
          headline: 'Draft',
          topic: 'politics',
          region: 'us',
          is_blindspot: false,
          first_published: '2026-04-01T00:00:00Z',
          last_updated: '2026-04-01T00:00:00Z',
          publication_status: 'draft',
        },
      }),
      makeArticleRow(),
    ]
    const client = makeClient([{ id: 's-1' }], null, rows, null)
    const result = await queryRecentStoriesForOwner(client, 'owner-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('story-1')
  })
})
