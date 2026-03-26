import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/query-helpers', () => ({
  querySourceBySlug: vi.fn(),
  queryRecentStoriesForSource: vi.fn(),
}))

import { GET } from '@/app/api/sources/[slug]/route'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { querySourceBySlug, queryRecentStoriesForSource } from '@/lib/api/query-helpers'

const mockGetSupabaseServerClient = vi.mocked(getSupabaseServerClient)
const mockQuerySourceBySlug = vi.mocked(querySourceBySlug)
const mockQueryRecentStoriesForSource = vi.mocked(queryRecentStoriesForSource)

function makeRequest() {
  return new NextRequest(new URL('http://localhost/api/sources/reuters'))
}

describe('GET /api/sources/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSupabaseServerClient.mockReturnValue({} as never)
  })

  it('returns 404 when the source does not exist', async () => {
    mockQuerySourceBySlug.mockResolvedValue(null)

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ slug: 'missing-source' }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Source not found')
  })

  it('returns a source profile with recent coverage rollups', async () => {
    mockQuerySourceBySlug.mockResolvedValue({
      id: 'src-1',
      slug: 'reuters',
      name: 'Reuters',
      bias: 'center',
      factuality: 'very-high',
      ownership: 'corporate',
      url: 'reuters.com',
      rss_url: 'https://reuters.com/rss',
      region: 'international',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as never)

    mockQueryRecentStoriesForSource.mockResolvedValue([
      {
        id: 'story-1',
        headline: 'Top Story',
        topic: 'politics',
        region: 'us',
        timestamp: '2026-03-03T10:30:00Z',
        isBlindspot: false,
        articleUrl: 'https://reuters.com/story-1',
      },
      {
        id: 'story-2',
        headline: 'Blindspot Story',
        topic: 'world',
        region: 'international',
        timestamp: '2026-03-01T09:15:00Z',
        isBlindspot: true,
        articleUrl: 'https://reuters.com/story-2',
      },
    ] as never)

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ slug: 'reuters' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.source).toMatchObject({
      id: 'src-1',
      slug: 'reuters',
      name: 'Reuters',
      isActive: true,
    })
    expect(body.data.recentStories).toHaveLength(2)
    expect(body.data.blindspotCount).toBe(1)
    expect(body.data.topicBreakdown).toEqual([
      { topic: 'politics', count: 1 },
      { topic: 'world', count: 1 },
    ])
  })
})
