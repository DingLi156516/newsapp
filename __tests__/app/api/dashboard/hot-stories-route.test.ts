import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/api/engagement-queries', () => ({
  queryTopEngagedStories: vi.fn(),
}))

import { GET } from '@/app/api/dashboard/hot-stories/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { queryTopEngagedStories } from '@/lib/api/engagement-queries'

const mockAuth = vi.mocked(getAuthenticatedUser)
const mockTop = vi.mocked(queryTopEngagedStories)

function makeStoryRow(id: string) {
  return {
    id,
    headline: `Story ${id}`,
    topic: 'politics',
    region: 'us',
    source_count: 3,
    is_blindspot: false,
    image_url: null,
    factuality: 'high',
    ownership: 'corporate',
    spectrum_segments: [{ bias: 'center', percentage: 100 }],
    ai_summary: { commonGround: '', leftFraming: '', rightFraming: '' },
    published_at: '2026-04-22T00:00:00Z',
    first_published: '2026-04-22T00:00:00Z',
    last_updated: '2026-04-22T00:00:00Z',
  }
}

function makeSupabaseMock(storyRows: ReturnType<typeof makeStoryRow>[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: storyRows, error: null }),
  }
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/dashboard/hot-stories', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'no auth', supabase: {} as never })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty array when no engagement data', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1' } as never,
      error: null,
      supabase: makeSupabaseMock([]) as never,
    })
    mockTop.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, data: [] })
  })

  it('returns stories ordered by engagement, with uniqueViewers6h annotation', async () => {
    const supa = makeSupabaseMock([makeStoryRow('a'), makeStoryRow('b'), makeStoryRow('c')])
    mockAuth.mockResolvedValue({
      user: { id: 'u1' } as never,
      error: null,
      supabase: supa as never,
    })
    mockTop.mockResolvedValue([
      { storyId: 'b', uniqueViewers: 50 },
      { storyId: 'a', uniqueViewers: 20 },
      { storyId: 'c', uniqueViewers: 5 },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.map((s: { id: string }) => s.id)).toEqual(['b', 'a', 'c'])
    expect(json.data[0].uniqueViewers6h).toBe(50)
  })

  it('sets a private Cache-Control header (no shared-cache leak across users)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1' } as never,
      error: null,
      supabase: makeSupabaseMock([]) as never,
    })
    mockTop.mockResolvedValue([])
    const res = await GET()
    const cc = res.headers.get('cache-control') ?? ''
    expect(cc).toContain('private')
    expect(cc).not.toContain('s-maxage')
    expect(cc).not.toContain('public')
  })

  it('returns 500 when engagement query throws', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1' } as never,
      error: null,
      supabase: makeSupabaseMock([]) as never,
    })
    mockTop.mockRejectedValue(new Error('boom'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
