import { queryOwners, queryOwnerById } from '@/lib/api/owner-queries'
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
