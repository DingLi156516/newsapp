import { GET } from '@/app/api/owners/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/owner-queries', () => ({
  queryOwners: vi.fn(),
}))

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryOwners } from '@/lib/api/owner-queries'

const mockClient = {} as never
const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQueryOwners = vi.mocked(queryOwners)

function makeRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost/api/owners')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return new NextRequest(url)
}

describe('GET /api/owners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue(mockClient)
  })

  it('returns owners with pagination meta', async () => {
    const ownerRow = {
      id: 'owner-1',
      name: 'Fox Corporation',
      slug: 'fox-corporation',
      owner_type: 'public_company' as const,
      is_individual: false,
      country: 'United States',
      wikidata_qid: 'Q186068',
      parent_owner_id: null,
      owner_source: 'wikidata' as const,
      owner_verified_at: '2026-04-01T00:00:00Z',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
      source_count: 1,
    }
    mockQueryOwners.mockResolvedValue({ data: [ownerRow], count: 1 })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Fox Corporation')
    expect(body.data[0].ownerType).toBe('public_company')
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 50 })
  })

  it('passes search and owner_type params', async () => {
    mockQueryOwners.mockResolvedValue({ data: [], count: 0 })

    await GET(makeRequest({ search: 'Fox', owner_type: 'public_company' }))

    expect(mockQueryOwners).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ search: 'Fox', owner_type: 'public_company' })
    )
  })

  it('returns 400 for invalid owner_type', async () => {
    const response = await GET(makeRequest({ owner_type: 'invalid' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
  })

  it('returns 500 on query error', async () => {
    mockQueryOwners.mockRejectedValue(new Error('DB error'))

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe('DB error')
  })
})
