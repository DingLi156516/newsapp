import { POST } from '@/app/api/admin/pipeline/trigger/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'run-mock-id' },
            error: null,
          }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
  })),
}))

vi.mock('@/lib/pipeline/logger', () => {
  const mockLogger = {
    startRun: vi.fn().mockResolvedValue('run-mock-id'),
    logStep: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    getRunId: vi.fn(() => 'run-mock-id'),
    getSteps: vi.fn(() => []),
  }
  return {
    PipelineLogger: vi.fn(() => mockLogger),
    __mockLogger: mockLogger,
  }
})

vi.mock('@/lib/rss/ingest', () => ({
  ingestFeeds: vi.fn().mockResolvedValue({ totalFeeds: 3, newArticles: 10 }),
}))

vi.mock('@/lib/ai/embeddings', () => ({
  embedUnembeddedArticles: vi.fn(),
}))

vi.mock('@/lib/ai/clustering', () => ({
  clusterArticles: vi.fn(),
}))

vi.mock('@/lib/ai/story-assembler', () => ({
  assembleStories: vi.fn(),
}))

vi.mock('@/lib/pipeline/backlog', () => ({
  countPipelineBacklog: vi.fn()
}))

describe('POST /api/admin/pipeline/trigger', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { embedUnembeddedArticles } = await import('@/lib/ai/embeddings')
    vi.mocked(embedUnembeddedArticles).mockReset()
    vi.mocked(embedUnembeddedArticles)
      .mockResolvedValueOnce({ totalProcessed: 5, claimedArticles: 5, cacheHits: 0, errors: [] })
      .mockResolvedValue({ totalProcessed: 0, claimedArticles: 0, cacheHits: 0, errors: [] })

    const { clusterArticles } = await import('@/lib/ai/clustering')
    vi.mocked(clusterArticles).mockReset()
    vi.mocked(clusterArticles)
      .mockResolvedValueOnce({
        newStories: 2,
        updatedStories: 1,
        assignedArticles: 7,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 3,
        errors: [],
      })
      .mockResolvedValue({
        newStories: 0,
        updatedStories: 0,
        assignedArticles: 0,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 0,
        errors: [],
      })

    const { assembleStories } = await import('@/lib/ai/story-assembler')
    vi.mocked(assembleStories).mockReset()
    vi.mocked(assembleStories)
      .mockResolvedValueOnce({
        storiesProcessed: 2,
        claimedStories: 2,
        autoPublished: 1,
        sentToReview: 1,
        errors: [],
      })
      .mockResolvedValue({
        storiesProcessed: 0,
        claimedStories: 0,
        autoPublished: 0,
        sentToReview: 0,
        errors: [],
      })

    const { countPipelineBacklog } = await import('@/lib/pipeline/backlog')
    vi.mocked(countPipelineBacklog).mockReset()
    vi.mocked(countPipelineBacklog).mockResolvedValue({
      unembeddedArticles: 10,
      unclusteredArticles: 4,
      pendingAssemblyStories: 2,
      reviewQueueStories: 3,
      expiredArticles: 0,
    })
  })

  function makeRequest(body?: unknown) {
    return new NextRequest('http://localhost/api/admin/pipeline/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  it('returns 401 for unauthenticated users', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const response = await POST(makeRequest({ type: 'ingest' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
  })

  it('returns 403 for non-admin users', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const response = await POST(makeRequest({ type: 'ingest' }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
  })

  it('returns 400 for invalid body', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const request = new NextRequest('http://localhost/api/admin/pipeline/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid JSON body')
  })

  it('returns 400 for invalid type', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const response = await POST(makeRequest({ type: 'invalid' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
  })

  it('triggers ingest pipeline for type=ingest', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const response = await POST(makeRequest({ type: 'ingest' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.runId).toBe('run-mock-id')

    const { ingestFeeds } = await import('@/lib/rss/ingest')
    expect(ingestFeeds).toHaveBeenCalled()

    const { embedUnembeddedArticles } = await import('@/lib/ai/embeddings')
    expect(embedUnembeddedArticles).not.toHaveBeenCalled()
  })

  it('triggers process pipeline for type=process', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const response = await POST(makeRequest({ type: 'process' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.backlog.before).toEqual({
      unembeddedArticles: 10,
      unclusteredArticles: 4,
      pendingAssemblyStories: 2,
      reviewQueueStories: 3,
      expiredArticles: 0,
    })
    expect(body.data.embeddings).toEqual(expect.objectContaining({
      passes: expect.any(Number),
      skipped: expect.any(Boolean),
    }))
    expect(body.data.embeddings).toHaveProperty('skipReason')
    expect(body.data.clustering).toEqual(expect.objectContaining({
      passes: expect.any(Number),
      skipped: expect.any(Boolean),
    }))
    expect(body.data.clustering).toHaveProperty('skipReason')
    expect(body.data.assembly).toEqual(expect.objectContaining({
      passes: expect.any(Number),
      skipped: expect.any(Boolean),
    }))
    expect(body.data.assembly).toHaveProperty('skipReason')
    // With Infinity budget (default for admin triggers), assembly runs alongside freshness
    expect(body.data.assembly.skipped).toBe(false)
    expect(body.data.assembly.autoPublished).toBe(1)
    expect(body.data.assembly.sentToReview).toBe(1)

    const { ingestFeeds } = await import('@/lib/rss/ingest')
    expect(ingestFeeds).not.toHaveBeenCalled()

    const { embedUnembeddedArticles } = await import('@/lib/ai/embeddings')
    const { clusterArticles } = await import('@/lib/ai/clustering')
    const { assembleStories } = await import('@/lib/ai/story-assembler')
    expect(embedUnembeddedArticles).toHaveBeenCalled()
    expect(clusterArticles).toHaveBeenCalled()
    expect(assembleStories).toHaveBeenCalled()
  })

  it('triggers full pipeline for type=full', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const response = await POST(makeRequest({ type: 'full' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)

    const { ingestFeeds } = await import('@/lib/rss/ingest')
    const { embedUnembeddedArticles } = await import('@/lib/ai/embeddings')
    const { clusterArticles } = await import('@/lib/ai/clustering')
    const { assembleStories } = await import('@/lib/ai/story-assembler')
    expect(ingestFeeds).toHaveBeenCalled()
    expect(embedUnembeddedArticles).toHaveBeenCalled()
    expect(clusterArticles).toHaveBeenCalled()
    // With Infinity budget, assembly runs alongside freshness stages
    expect(assembleStories).toHaveBeenCalled()
    expect(body.data.assembly.skipped).toBe(false)
  })

  it('returns 500 on pipeline error', async () => {
    const { getAdminUser } = await import('@/lib/api/admin-helpers')
    vi.mocked(getAdminUser).mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const { __mockLogger } = await import('@/lib/pipeline/logger') as never as {
      __mockLogger: Record<string, ReturnType<typeof vi.fn>>
    }

    __mockLogger.logStep.mockImplementationOnce(async () => {
      throw new Error('Feed fetch failed')
    })

    const response = await POST(makeRequest({ type: 'ingest' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Feed fetch failed')
    expect(__mockLogger.fail).toHaveBeenCalledWith('Feed fetch failed')
  })
})
