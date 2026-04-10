import { GET } from '@/app/api/admin/pipeline/events/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

function makeRequest(url = 'http://localhost/api/admin/pipeline/events') {
  return new NextRequest(url)
}

function makeEventsQueryBuilder(
  result: { data: unknown[] | null; error: { message: string } | null } = {
    data: [],
    error: null,
  }
) {
  // Final thenable that resolves to the result when awaited.
  const thenable = {
    then: (resolve: (value: typeof result) => void) => resolve(result),
  }
  // Chain-compatible mock where order/range/eq/in/gte return the same
  // builder so the route can call them in any order before awaiting.
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  builder.select = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.range = vi.fn(() => thenable as never)
  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  return builder
}

function makeMockClient(
  builder: ReturnType<typeof makeEventsQueryBuilder>
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'pipeline_stage_events') return builder
      return {}
    }),
  }
}

describe('GET /api/admin/pipeline/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
  })

  it('returns 403 for authenticated but non-admin users', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
  })

  it('returns 200 with empty array when no events exist', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('applies runId filter via .eq()', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    const runId = 'd290f1ee-6c54-4b01-90e6-d701748f0851'
    await GET(makeRequest(`http://localhost/api/admin/pipeline/events?runId=${runId}`))

    expect(builder.eq).toHaveBeenCalledWith('run_id', runId)
  })

  it('applies stage filter via .eq()', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    await GET(makeRequest('http://localhost/api/admin/pipeline/events?stage=cluster'))

    expect(builder.eq).toHaveBeenCalledWith('stage', 'cluster')
  })

  it('applies comma-separated level filter via .in()', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    await GET(makeRequest('http://localhost/api/admin/pipeline/events?level=warn,error'))

    expect(builder.in).toHaveBeenCalledWith('level', ['warn', 'error'])
  })

  it('applies a single-value level filter via .in() with one element', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    await GET(makeRequest('http://localhost/api/admin/pipeline/events?level=error'))

    expect(builder.in).toHaveBeenCalledWith('level', ['error'])
  })

  it('applies default limit=50 and offset=0 via .range()', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    await GET(makeRequest())

    // Supabase range is inclusive on both ends: offset..offset+limit-1
    expect(builder.range).toHaveBeenCalledWith(0, 49)
  })

  it('caps limit at 500', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder as never) as never)

    await GET(makeRequest('http://localhost/api/admin/pipeline/events?limit=9999'))

    expect(builder.range).toHaveBeenCalledWith(0, 499)
  })

  it('returns 400 for an invalid stage value', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    const response = await GET(
      makeRequest('http://localhost/api/admin/pipeline/events?stage=bogus')
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 for an invalid runId', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder()
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    const response = await GET(
      makeRequest('http://localhost/api/admin/pipeline/events?runId=not-a-uuid')
    )

    expect(response.status).toBe(400)
  })

  it('returns 500 when the DB query errors', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const builder = makeEventsQueryBuilder({
      data: null,
      error: { message: 'query failed' },
    })
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeMockClient(builder) as never)

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toContain('query failed')
  })
})
