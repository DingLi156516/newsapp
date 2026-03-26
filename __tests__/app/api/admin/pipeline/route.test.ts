import { GET } from '@/app/api/admin/pipeline/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

describe('GET /api/admin/pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeRequest(url = 'http://localhost/api/admin/pipeline') {
    return new NextRequest(url)
  }

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

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Forbidden')
  })

  it('returns pipeline runs for admin users', async () => {
    const mockRuns = [
      { id: 'run-1', run_type: 'ingest', status: 'completed' },
      { id: 'run-2', run_type: 'full', status: 'failed' },
    ]

    const mockLimit = vi.fn().mockResolvedValue({ data: mockRuns, error: null })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockSelect = vi.fn(() => ({ order: mockOrder }))
    const mockSupabase = { from: vi.fn(() => ({ select: mockSelect })) }

    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: mockSupabase as never,
    })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockRuns)
    expect(mockSupabase.from).toHaveBeenCalledWith('pipeline_runs')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockOrder).toHaveBeenCalledWith('started_at', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(20)
  })

  it('respects limit param and defaults to 20', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockSelect = vi.fn(() => ({ order: mockOrder }))
    const mockSupabase = { from: vi.fn(() => ({ select: mockSelect })) }

    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: mockSupabase as never,
    })

    // Default limit = 20
    await GET(makeRequest())
    expect(mockLimit).toHaveBeenCalledWith(20)

    // Custom limit = 50
    mockLimit.mockClear()
    await GET(makeRequest('http://localhost/api/admin/pipeline?limit=50'))
    expect(mockLimit).toHaveBeenCalledWith(50)

    // Max limit capped at 100
    mockLimit.mockClear()
    await GET(makeRequest('http://localhost/api/admin/pipeline?limit=999'))
    expect(mockLimit).toHaveBeenCalledWith(100)
  })
})
