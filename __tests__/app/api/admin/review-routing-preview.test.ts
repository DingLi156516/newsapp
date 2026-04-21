/**
 * Tests for app/api/admin/review/[id]/routing-preview/route.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

import { GET } from '@/app/api/admin/review/[id]/routing-preview/route'
import { getAdminUser } from '@/lib/api/admin-helpers'

const mockGetAdmin = vi.mocked(getAdminUser)

const ORIGINAL_MODE = process.env.PIPELINE_ASSEMBLY_MODE
const ORIGINAL_MIN_SOURCES = process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES
const ORIGINAL_MIN_BUCKETS = process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS

function restore(name: string, original: string | undefined) {
  if (original === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = original
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.PIPELINE_ASSEMBLY_MODE
  delete process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES
  delete process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS
})

afterEach(() => {
  restore('PIPELINE_ASSEMBLY_MODE', ORIGINAL_MODE)
  restore('PIPELINE_RICH_CLUSTER_MIN_SOURCES', ORIGINAL_MIN_SOURCES)
  restore('PIPELINE_RICH_CLUSTER_MIN_BUCKETS', ORIGINAL_MIN_BUCKETS)
})

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/review/story-1/routing-preview')
}

function buildParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// Build a mock Supabase client whose articles + sources queries return
// fixed data. The route does two reads: articles(story_id = id) and
// sources(id in [...]).
function createMockClient(
  articles: Array<{ source_id: string }>,
  sources: Array<{ id: string; bias: string }>
) {
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'articles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: articles, error: null }),
        }),
      }
    }
    if (table === 'sources') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: sources, error: null }),
        }),
      }
    }
    return {}
  })
  return { from } as never
}

describe('GET /api/admin/review/[id]/routing-preview', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    expect(res.status).toBe(403)
  })

  it('returns rich path for 3-source L/C/R cluster', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient(
        [{ source_id: 's1' }, { source_id: 's2' }, { source_id: 's3' }],
        [
          { id: 's1', bias: 'left' },
          { id: 's2', bias: 'center' },
          { id: 's3', bias: 'right' },
        ]
      ),
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.storyId).toBe('story-1')
    expect(json.data.sourceCount).toBe(3)
    expect(json.data.biases).toEqual(expect.arrayContaining(['left', 'center', 'right']))
    expect(json.data.distinctBiasBuckets).toBe(3)
    expect(json.data.assemblyPath).toBe('rich')
    expect(json.data.appliedThresholds.minSources).toBe(3)
    expect(json.data.appliedThresholds.minBuckets).toBe(2)
    expect(json.data.appliedThresholds.modeOverride).toBeNull()
  })

  it('returns single path for 1-source story', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient(
        [{ source_id: 's1' }, { source_id: 's1' }],
        [{ id: 's1', bias: 'left' }]
      ),
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    const json = await res.json()
    expect(json.data.sourceCount).toBe(1)
    expect(json.data.assemblyPath).toBe('single')
  })

  it('returns thin path for 2-source L+R cluster (below minSources)', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient(
        [{ source_id: 's1' }, { source_id: 's2' }],
        [
          { id: 's1', bias: 'left' },
          { id: 's2', bias: 'right' },
        ]
      ),
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    const json = await res.json()
    expect(json.data.assemblyPath).toBe('thin')
    expect(json.data.distinctBiasBuckets).toBe(2)
  })

  it('returns thin path for 3-source all-left cluster (below minBuckets)', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient(
        [{ source_id: 's1' }, { source_id: 's2' }, { source_id: 's3' }],
        [
          { id: 's1', bias: 'far-left' },
          { id: 's2', bias: 'left' },
          { id: 's3', bias: 'lean-left' },
        ]
      ),
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    const json = await res.json()
    expect(json.data.assemblyPath).toBe('thin')
    expect(json.data.distinctBiasBuckets).toBe(1)
  })

  it('reports PIPELINE_ASSEMBLY_MODE=deterministic override', async () => {
    process.env.PIPELINE_ASSEMBLY_MODE = 'deterministic'
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient(
        [{ source_id: 's1' }, { source_id: 's2' }, { source_id: 's3' }],
        [
          { id: 's1', bias: 'left' },
          { id: 's2', bias: 'center' },
          { id: 's3', bias: 'right' },
        ]
      ),
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    const json = await res.json()
    expect(json.data.assemblyPath).toBe('thin')
    expect(json.data.appliedThresholds.modeOverride).toBe('deterministic')
  })

  it('reports PIPELINE_ASSEMBLY_MODE=gemini override', async () => {
    process.env.PIPELINE_ASSEMBLY_MODE = 'gemini'
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient(
        [{ source_id: 's1' }, { source_id: 's2' }],
        [
          { id: 's1', bias: 'left' },
          { id: 's2', bias: 'left' },
        ]
      ),
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    const json = await res.json()
    expect(json.data.assemblyPath).toBe('rich')
    expect(json.data.appliedThresholds.modeOverride).toBe('gemini')
  })

  it('returns 404 when story has no articles', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient([], []),
    })

    const res = await GET(makeRequest(), buildParams('missing-story'))
    expect(res.status).toBe(404)
  })

  it('respects custom thresholds from env', async () => {
    process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES = '4'
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: createMockClient(
        [{ source_id: 's1' }, { source_id: 's2' }, { source_id: 's3' }],
        [
          { id: 's1', bias: 'left' },
          { id: 's2', bias: 'center' },
          { id: 's3', bias: 'right' },
        ]
      ),
    })

    const res = await GET(makeRequest(), buildParams('story-1'))
    const json = await res.json()
    expect(json.data.appliedThresholds.minSources).toBe(4)
    expect(json.data.assemblyPath).toBe('thin')
  })
})
