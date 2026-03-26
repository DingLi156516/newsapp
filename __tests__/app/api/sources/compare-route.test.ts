import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/query-helpers', () => ({
  querySourceBySlug: vi.fn(),
  queryRecentStoriesForSource: vi.fn(),
}))

import { GET } from '@/app/api/sources/compare/route'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryRecentStoriesForSource, querySourceBySlug } from '@/lib/api/query-helpers'

const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQuerySourceBySlug = vi.mocked(querySourceBySlug)
const mockQueryRecentStoriesForSource = vi.mocked(queryRecentStoriesForSource)

function makeRequest(query: string) {
  return new NextRequest(new URL(`http://localhost/api/sources/compare?${query}`))
}

describe('GET /api/sources/compare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue({} as never)
  })

  it('returns 400 when left or right is missing', async () => {
    const response = await GET(makeRequest('left=reuters'))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Both left and right source slugs are required')
  })

  it('returns 404 when one source does not exist', async () => {
    mockQuerySourceBySlug
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'src-2',
        slug: 'fox-news',
        name: 'Fox News',
        bias: 'right',
        factuality: 'mixed',
        ownership: 'corporate',
        url: 'foxnews.com',
        rss_url: null,
        region: 'us',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as never)

    const response = await GET(makeRequest('left=missing&right=fox-news'))
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('One or both sources were not found')
  })

  it('returns structured comparison data for valid sources', async () => {
    mockQuerySourceBySlug
      .mockResolvedValueOnce({
        id: 'src-1',
        slug: 'reuters',
        name: 'Reuters',
        bias: 'center',
        factuality: 'very-high',
        ownership: 'corporate',
        url: 'reuters.com',
        rss_url: null,
        region: 'international',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as never)
      .mockResolvedValueOnce({
        id: 'src-2',
        slug: 'fox-news',
        name: 'Fox News',
        bias: 'right',
        factuality: 'mixed',
        ownership: 'corporate',
        url: 'foxnews.com',
        rss_url: null,
        region: 'us',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as never)

    mockQueryRecentStoriesForSource
      .mockResolvedValueOnce([
        {
          id: 'story-1',
          headline: 'Shared Story',
          topic: 'politics',
          region: 'us',
          timestamp: '2026-03-03T10:00:00Z',
          isBlindspot: false,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 'story-1',
          headline: 'Shared Story',
          topic: 'politics',
          region: 'us',
          timestamp: '2026-03-03T10:00:00Z',
          isBlindspot: false,
        },
        {
          id: 'story-2',
          headline: 'Exclusive Story',
          topic: 'world',
          region: 'international',
          timestamp: '2026-03-04T10:00:00Z',
          isBlindspot: true,
        },
      ] as never)

    const response = await GET(makeRequest('left=reuters&right=fox-news'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.leftSource.slug).toBe('reuters')
    expect(body.data.rightSource.slug).toBe('fox-news')
    expect(body.data.sharedStories).toHaveLength(1)
    expect(body.data.rightExclusiveStories).toHaveLength(1)
    expect(body.data.stats.rightBlindspotCount).toBe(1)
  })
})
