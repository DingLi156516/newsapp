import { GET } from '@/app/api/admin/pipeline/stats/route'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/pipeline/backlog', () => ({
  countPipelineBacklog: vi.fn(),
}))

describe('GET /api/admin/pipeline/stats', () => {
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

  it('returns backlog and count stats for admin users', async () => {
    const publishedEq = vi.fn().mockResolvedValue({ count: 12, error: null })
    const storiesSelect = vi.fn().mockReturnValue({ eq: publishedEq })
    const articlesSelect = vi.fn().mockResolvedValue({ count: 34, error: null })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'stories') {
          return { select: storiesSelect }
        }

        if (table === 'articles') {
          return { select: articlesSelect }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: supabase as never,
    })

    const { countPipelineBacklog } = await import('@/lib/pipeline/backlog')
    vi.mocked(countPipelineBacklog).mockResolvedValue({
      unembeddedArticles: 5,
      unclusteredArticles: 3,
      pendingAssemblyStories: 2,
      reviewQueueStories: 4,
      expiredArticles: 1,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      data: {
        publishedStories: 12,
        totalArticles: 34,
        reviewQueue: 4,
        unembedded: 5,
        unclustered: 3,
        expiredArticles: 1,
      },
    })
    expect(countPipelineBacklog).toHaveBeenCalledWith(supabase)
    expect(supabase.from).toHaveBeenCalledWith('stories')
    expect(supabase.from).toHaveBeenCalledWith('articles')
    expect(storiesSelect).toHaveBeenCalledWith('id', { count: 'exact' })
    expect(publishedEq).toHaveBeenCalledWith('publication_status', 'published')
    expect(articlesSelect).toHaveBeenCalledWith('id', { count: 'exact' })
  })

  it('returns 500 when stats loading throws', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {
        from: vi.fn(() => {
          throw new Error('database exploded')
        }),
      } as never,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe('database exploded')
  })
})
