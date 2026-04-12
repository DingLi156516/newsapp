import { GET } from '@/app/api/owners/[id]/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/owner-queries', () => ({
  queryOwnerById: vi.fn(),
}))

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryOwnerById } from '@/lib/api/owner-queries'

const mockClient = {} as never
const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQueryOwnerById = vi.mocked(queryOwnerById)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

function makeRequest(id: string) {
  return new NextRequest(new URL(`http://localhost/api/owners/${id}`))
}

describe('GET /api/owners/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue(mockClient)
  })

  it('returns owner with sources', async () => {
    const ownerRow = {
      id: VALID_UUID,
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
    }
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
    mockQueryOwnerById.mockResolvedValue({ owner: ownerRow as never, sources: [sourceRow] as never })

    const response = await GET(makeRequest(VALID_UUID), { params: Promise.resolve({ id: VALID_UUID }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.owner.name).toBe('Fox Corporation')
    expect(body.data.sources).toHaveLength(1)
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await GET(makeRequest('not-a-uuid'), { params: Promise.resolve({ id: 'not-a-uuid' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid owner ID format')
  })

  it('returns 404 when owner not found', async () => {
    mockQueryOwnerById.mockResolvedValue(null)

    const response = await GET(makeRequest(VALID_UUID), { params: Promise.resolve({ id: VALID_UUID }) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Owner not found')
  })

  it('returns 500 on query error', async () => {
    mockQueryOwnerById.mockRejectedValue(new Error('DB error'))

    const response = await GET(makeRequest(VALID_UUID), { params: Promise.resolve({ id: VALID_UUID }) })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
  })
})
