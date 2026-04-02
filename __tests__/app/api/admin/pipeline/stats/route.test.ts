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
    const pipelineRunsLimit = vi.fn().mockResolvedValue({
      data: [
        {
          run_type: 'ingest',
          summary: { ingest: { ingestedPerMinute: 12.5 } },
          started_at: '2026-04-02T00:00:00.000Z',
        },
        {
          run_type: 'process',
          summary: {
            telemetry: { processedPerMinute: 10.5 },
            embeddings: { processedPerMinute: 8.5 },
            clustering: { processedPerMinute: 6.5 },
            assembly: { processedPerMinute: 4.5 },
          },
          started_at: '2026-04-02T00:05:00.000Z',
        },
      ],
      error: null,
    })
    const pipelineRunsOrder = vi.fn().mockReturnValue({ limit: pipelineRunsLimit })
    const pipelineRunsEq = vi.fn().mockReturnValue({ order: pipelineRunsOrder })
    const pipelineRunsSelect = vi.fn().mockReturnValue({ eq: pipelineRunsEq })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'stories') {
          return { select: storiesSelect }
        }

        if (table === 'articles') {
          return { select: articlesSelect }
        }

        if (table === 'pipeline_runs') {
          return { select: pipelineRunsSelect }
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
      oldestAgeMinutes: {
        unembeddedArticles: 17,
        unclusteredArticles: 12,
        pendingAssemblyStories: 8,
        reviewQueueStories: 24,
        expiredArticles: 60,
      },
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
        backlogAgesMinutes: {
          unembeddedArticles: 17,
          unclusteredArticles: 12,
          pendingAssemblyStories: 8,
          reviewQueueStories: 24,
          expiredArticles: 60,
        },
        ratesPerMinute: {
          ingest: 12.5,
          process: 10.5,
          embeddings: 8.5,
          clustering: 6.5,
          assembly: 4.5,
        },
      },
    })
    expect(countPipelineBacklog).toHaveBeenCalledWith(supabase, { includeAges: true })
    expect(supabase.from).toHaveBeenCalledWith('stories')
    expect(supabase.from).toHaveBeenCalledWith('articles')
    expect(supabase.from).toHaveBeenCalledWith('pipeline_runs')
    expect(storiesSelect).toHaveBeenCalledWith('id', { count: 'exact' })
    expect(publishedEq).toHaveBeenCalledWith('publication_status', 'published')
    expect(articlesSelect).toHaveBeenCalledWith('id', { count: 'exact' })
    expect(pipelineRunsSelect).toHaveBeenCalledWith('run_type, summary, started_at')
    expect(pipelineRunsEq).toHaveBeenCalledWith('status', 'completed')
    expect(pipelineRunsOrder).toHaveBeenCalledWith('started_at', { ascending: false })
    expect(pipelineRunsLimit).toHaveBeenCalledWith(20)
  })

  it('reads ingest rate from top-level ingest summaries emitted by cron ingest runs', async () => {
    const publishedEq = vi.fn().mockResolvedValue({ count: 12, error: null })
    const storiesSelect = vi.fn().mockReturnValue({ eq: publishedEq })
    const articlesSelect = vi.fn().mockResolvedValue({ count: 34, error: null })
    const pipelineRunsLimit = vi.fn().mockResolvedValue({
      data: [
        {
          run_type: 'ingest',
          summary: { newArticles: 50, ingestedPerMinute: 12.5 },
          started_at: '2026-04-02T00:00:00.000Z',
        },
      ],
      error: null,
    })
    const pipelineRunsOrder = vi.fn().mockReturnValue({ limit: pipelineRunsLimit })
    const pipelineRunsEq = vi.fn().mockReturnValue({ order: pipelineRunsOrder })
    const pipelineRunsSelect = vi.fn().mockReturnValue({ eq: pipelineRunsEq })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'stories') return { select: storiesSelect }
        if (table === 'articles') return { select: articlesSelect }
        if (table === 'pipeline_runs') return { select: pipelineRunsSelect }
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
      oldestAgeMinutes: {
        unembeddedArticles: 17,
        unclusteredArticles: 12,
        pendingAssemblyStories: 8,
        reviewQueueStories: 24,
        expiredArticles: 60,
      },
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.ratesPerMinute.ingest).toBe(12.5)
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
