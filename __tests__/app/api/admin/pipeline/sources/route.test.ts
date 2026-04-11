import { GET } from '@/app/api/admin/pipeline/sources/route'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

describe('GET /api/admin/pipeline/sources', () => {
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

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 for non-admin users', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Forbidden')
  })

  it('returns source health data for admin users', async () => {
    const mockSources = [
      {
        id: 's1',
        slug: 'reuters',
        name: 'Reuters',
        bias: 'center',
        region: 'US',
        is_active: true,
        last_fetch_at: '2026-03-18T00:00:00Z',
        last_fetch_status: 'success',
        last_fetch_error: null,
        consecutive_failures: 0,
        total_articles_ingested: 120,
        cooldown_until: null,
        auto_disabled_at: null,
        auto_disabled_reason: null,
      },
      {
        id: 's2',
        slug: 'broken-feed',
        name: 'Broken Feed',
        bias: 'left',
        region: 'US',
        is_active: true,
        last_fetch_at: '2026-03-17T00:00:00Z',
        last_fetch_status: 'error',
        last_fetch_error: 'ETIMEDOUT',
        consecutive_failures: 3,
        total_articles_ingested: 50,
        cooldown_until: null,
        auto_disabled_at: null,
        auto_disabled_reason: null,
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({ data: mockSources, error: null })
    const mockSelect = vi.fn(() => ({ order: mockOrder }))
    const mockSupabase = { from: vi.fn(() => ({ select: mockSelect })) }

    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: mockSupabase as never,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual([
      {
        ...mockSources[0],
        needs_attention: false,
      },
      {
        ...mockSources[1],
        needs_attention: true,
      },
    ])
    expect(mockSupabase.from).toHaveBeenCalledWith('sources')
    expect(mockSelect).toHaveBeenCalledWith(
      'id, slug, name, bias, region, source_type, is_active, last_fetch_at, last_fetch_status, last_fetch_error, consecutive_failures, total_articles_ingested, cooldown_until, auto_disabled_at, auto_disabled_reason'
    )
    expect(mockOrder).toHaveBeenCalledWith('consecutive_failures', { ascending: false })
  })

  it('does NOT flag sources with expired cooldowns as needs_attention', async () => {
    const mockSources = [
      {
        id: 's5',
        slug: 'recovered',
        name: 'Recovered Source',
        bias: 'center',
        region: 'US',
        is_active: true,
        last_fetch_at: '2026-03-18T00:00:00Z',
        last_fetch_status: 'success',
        last_fetch_error: null,
        consecutive_failures: 0,
        total_articles_ingested: 10,
        // Past cooldown — not cleared by increment_source_success
        cooldown_until: '2020-01-01T00:00:00Z',
        auto_disabled_at: null,
        auto_disabled_reason: null,
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({ data: mockSources, error: null })
    const mockSelect = vi.fn(() => ({ order: mockOrder }))
    const mockSupabase = { from: vi.fn(() => ({ select: mockSelect })) }

    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: mockSupabase as never,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data[0].needs_attention).toBe(false)
  })

  it('flags sources in cooldown or auto-disabled as needs_attention', async () => {
    const mockSources = [
      {
        id: 's3',
        slug: 'cooling',
        name: 'Cooling Source',
        bias: 'center',
        region: 'US',
        is_active: true,
        last_fetch_at: '2026-03-18T00:00:00Z',
        last_fetch_status: 'success',
        last_fetch_error: null,
        consecutive_failures: 1,
        total_articles_ingested: 5,
        cooldown_until: '2126-04-11T00:00:00Z',
        auto_disabled_at: null,
        auto_disabled_reason: null,
      },
      {
        id: 's4',
        slug: 'autodown',
        name: 'Auto Down Source',
        bias: 'right',
        region: 'US',
        is_active: true,
        last_fetch_at: '2026-03-18T00:00:00Z',
        last_fetch_status: 'http_error',
        last_fetch_error: '500',
        consecutive_failures: 12,
        total_articles_ingested: 5,
        cooldown_until: null,
        auto_disabled_at: '2026-04-10T00:00:00Z',
        auto_disabled_reason: 'Auto-disabled: 12 consecutive failures',
      },
    ]

    const mockOrder = vi.fn().mockResolvedValue({ data: mockSources, error: null })
    const mockSelect = vi.fn(() => ({ order: mockOrder }))
    const mockSupabase = { from: vi.fn(() => ({ select: mockSelect })) }

    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: mockSupabase as never,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data[0].needs_attention).toBe(true)
    expect(body.data[1].needs_attention).toBe(true)
  })
})
