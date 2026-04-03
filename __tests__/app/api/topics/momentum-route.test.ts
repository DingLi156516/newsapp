import { GET } from '@/app/api/topics/momentum/route'

function createMockQueryBuilder(data: unknown = [], error: null | { message: string } = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      resolve({ data, error })
      return Promise.resolve({ data, error })
    }),
  }
  Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' })
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

describe('GET /api/topics/momentum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all 9 topics with correct shape', async () => {
    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const builder = createMockQueryBuilder([])
    vi.mocked(getSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(9)

    for (const item of body.data) {
      expect(item).toHaveProperty('topic')
      expect(item).toHaveProperty('stories_24h')
      expect(item).toHaveProperty('stories_7d')
      expect(item).toHaveProperty('stories_30d')
      expect(item).toHaveProperty('trend')
      expect(['rising', 'stable', 'declining']).toContain(item.trend)
    }
  })

  it('computes rising trend when 24h count exceeds 7d average', async () => {
    const now = new Date()
    const recentIso = new Date(now.getTime() - 1000).toISOString()

    // 10 stories in 24h, 10 stories total in 7d → avg daily = 10/7 ≈ 1.43, 24h=10 > 1.43*1.5
    const rows = Array.from({ length: 10 }, () => ({
      topic: 'politics',
      published_at: recentIso,
    }))

    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const builder = createMockQueryBuilder(rows)
    vi.mocked(getSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never)

    const response = await GET()
    const body = await response.json()
    const politics = body.data.find((t: { topic: string }) => t.topic === 'politics')

    expect(politics.stories_24h).toBe(10)
    expect(politics.trend).toBe('rising')
  })

  it('computes stable trend for moderate activity', async () => {
    const now = new Date()
    // 1 story per day for days 1-7 (none in last 24h, but 24h=0 < avg*0.5 → declining)
    // For stable: 24h between 0.5*avg and 1.5*avg. avg = 7/7 = 1. So 24h=1 is stable.
    // Put 1 story in 24h window and 6 more spread across the week
    const rows = [
      { topic: 'technology', published_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
      ...Array.from({ length: 6 }, (_, i) => ({
        topic: 'technology',
        published_at: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000 - 60 * 60 * 1000).toISOString(),
      })),
    ]

    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const builder = createMockQueryBuilder(rows)
    vi.mocked(getSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never)

    const response = await GET()
    const body = await response.json()
    const tech = body.data.find((t: { topic: string }) => t.topic === 'technology')

    expect(tech.trend).toBe('stable')
  })

  it('returns 500 on database error', async () => {
    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const builder = createMockQueryBuilder(null, { message: 'DB connection failed' })
    vi.mocked(getSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toContain('DB connection failed')
  })

  it('returns zero counts when no stories exist', async () => {
    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const builder = createMockQueryBuilder([])
    vi.mocked(getSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never)

    const response = await GET()
    const body = await response.json()

    for (const item of body.data) {
      expect(item.stories_24h).toBe(0)
      expect(item.stories_7d).toBe(0)
      expect(item.stories_30d).toBe(0)
    }
  })

  it('correctly buckets timestamps with +00:00 suffix', async () => {
    const now = new Date()
    // Use +00:00 suffix instead of Z — same meaning but different string representation
    const recentTs = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString().replace('Z', '+00:00')

    const rows = [
      { topic: 'science', published_at: recentTs },
    ]

    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const builder = createMockQueryBuilder(rows)
    vi.mocked(getSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never)

    const response = await GET()
    const body = await response.json()
    const science = body.data.find((t: { topic: string }) => t.topic === 'science')

    expect(science.stories_24h).toBe(1)
    expect(science.stories_7d).toBe(1)
    expect(science.stories_30d).toBe(1)
  })
})
