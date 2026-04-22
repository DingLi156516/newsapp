import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/owner-queries', () => ({
  queryOwnerBySlug: vi.fn(),
  queryRecentStoriesForOwner: vi.fn(),
}))

import { GET } from '@/app/api/owners/by-slug/[slug]/route'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  queryOwnerBySlug,
  queryRecentStoriesForOwner,
} from '@/lib/api/owner-queries'

const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQueryOwnerBySlug = vi.mocked(queryOwnerBySlug)
const mockQueryRecentStoriesForOwner = vi.mocked(queryRecentStoriesForOwner)

function makeRequest(slug: string) {
  return new NextRequest(new URL(`http://localhost/api/owners/by-slug/${slug}`))
}

const ownerRow = {
  id: 'owner-1',
  name: 'Fox Corporation',
  slug: 'fox-corporation',
  owner_type: 'public_company',
  is_individual: false,
  country: 'United States',
  wikidata_qid: 'Q186068',
  parent_owner_id: null,
  owner_source: 'wikidata',
  owner_verified_at: '2026-04-01T00:00:00Z',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
}

const sourceRow = {
  id: 'src-1',
  slug: 'fox-news',
  name: 'Fox News',
  bias: 'right',
  factuality: 'mixed',
  ownership: 'corporate',
  url: 'foxnews.com',
  region: 'us',
}

describe('GET /api/owners/by-slug/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue({} as never)
  })

  it('returns 404 when the owner does not exist', async () => {
    mockQueryOwnerBySlug.mockResolvedValue(null)

    const response = await GET(makeRequest('missing-owner'), {
      params: Promise.resolve({ slug: 'missing-owner' }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Owner not found')
  })

  it('returns an owner profile with sources, stories, and rollups', async () => {
    mockQueryOwnerBySlug.mockResolvedValue({
      owner: ownerRow as never,
      sources: [sourceRow] as never,
    })
    mockQueryRecentStoriesForOwner.mockResolvedValue([
      {
        id: 'story-1',
        headline: 'Top Story',
        topic: 'politics',
        region: 'us',
        timestamp: '2026-03-03T10:30:00Z',
        isBlindspot: false,
        articleUrl: 'https://foxnews.com/story-1',
      },
      {
        id: 'story-2',
        headline: 'Blindspot Story',
        topic: 'politics',
        region: 'us',
        timestamp: '2026-03-01T09:15:00Z',
        isBlindspot: true,
      },
    ] as never)

    const response = await GET(makeRequest('fox-corporation'), {
      params: Promise.resolve({ slug: 'fox-corporation' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.owner.name).toBe('Fox Corporation')
    expect(body.data.owner.slug).toBe('fox-corporation')
    expect(body.data.sources).toHaveLength(1)
    expect(body.data.sources[0].name).toBe('Fox News')
    expect(body.data.recentStories).toHaveLength(2)
    expect(body.data.storyCount).toBe(2)
    expect(body.data.blindspotCount).toBe(1)
    expect(body.data.topicBreakdown).toEqual([{ topic: 'politics', count: 2 }])
    expect(body.data.biasDistribution).toEqual([{ bias: 'right', percentage: 100 }])
  })

  it('returns 500 on query error', async () => {
    mockQueryOwnerBySlug.mockRejectedValue(new Error('DB error'))

    const response = await GET(makeRequest('fox-corporation'), {
      params: Promise.resolve({ slug: 'fox-corporation' }),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.success).toBe(false)
  })
})
