/**
 * Tests for lib/api/for-you-queries.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/preferences-queries', () => ({
  queryPreferences: vi.fn(),
}))

vi.mock('@/lib/api/reading-history-queries', () => ({
  queryReadStoryIds: vi.fn(),
}))

vi.mock('@/lib/api/bias-calculator', () => ({
  computeBiasProfile: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }),
        }),
      }),
    }),
  })),
}))

import { queryForYouStories } from '@/lib/api/for-you-queries'
import { queryPreferences } from '@/lib/api/preferences-queries'
import { queryReadStoryIds } from '@/lib/api/reading-history-queries'
import { computeBiasProfile } from '@/lib/api/bias-calculator'

const mockQueryPreferences = vi.mocked(queryPreferences)
const mockQueryReadStoryIds = vi.mocked(queryReadStoryIds)
const mockComputeBiasProfile = vi.mocked(computeBiasProfile)

function makeStoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'story-1',
    headline: 'Test Story',
    topic: 'politics',
    region: 'us',
    source_count: 5,
    is_blindspot: false,
    image_url: null,
    factuality: 'high',
    ownership: 'corporate',
    spectrum_segments: [{ bias: 'center', percentage: 100 }],
    ai_summary: { commonGround: '', leftFraming: '', rightFraming: '' },
    published_at: new Date().toISOString(),
    first_published: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    story_velocity: null,
    impact_score: null,
    source_diversity: null,
    controversy_score: null,
    sentiment: null,
    key_quotes: null,
    key_claims: null,
    ...overrides,
  }
}

function createMockClient(stories: unknown[] = [makeStoryRow()]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: stories, error: null }),
  }

  return {
    from: vi.fn().mockReturnValue(query),
    _query: query,
  }
}

describe('queryForYouStories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns scored and ranked stories', async () => {
    const stories = [
      makeStoryRow({ id: 'a', topic: 'politics' }),
      makeStoryRow({ id: 'b', topic: 'sports' }),
    ]
    const client = createMockClient(stories)

    mockQueryPreferences.mockResolvedValue({
      id: 'pref-1',
      user_id: 'user-1',
      followed_topics: ['politics'],
      default_region: 'us',
      default_perspective: 'all',
      factuality_minimum: 'mixed',
      blindspot_digest_enabled: false,
      created_at: '',
      updated_at: '',
    })
    mockQueryReadStoryIds.mockResolvedValue([])
    mockComputeBiasProfile.mockReturnValue({
      userDistribution: [],
      overallDistribution: [],
      blindspots: [],
      totalStoriesRead: 0,
      dominantBias: null,
    })

    const result = await queryForYouStories(
      client as never,
      'user-1',
      { page: 1, limit: 20 }
    )

    expect(client._query.eq).toHaveBeenCalledWith('publication_status', 'published')
    expect(result.data).toHaveLength(2)
    expect(result.count).toBe(2)
  })

  it('paginates results correctly', async () => {
    const stories = Array.from({ length: 5 }, (_, i) =>
      makeStoryRow({ id: `story-${i}`, topic: 'politics' })
    )
    const client = createMockClient(stories)

    mockQueryPreferences.mockResolvedValue({
      id: 'pref-1',
      user_id: 'user-1',
      followed_topics: [],
      default_region: 'us',
      default_perspective: 'all',
      factuality_minimum: 'mixed',
      blindspot_digest_enabled: false,
      created_at: '',
      updated_at: '',
    })
    mockQueryReadStoryIds.mockResolvedValue([])

    const result = await queryForYouStories(
      client as never,
      'user-1',
      { page: 1, limit: 2 }
    )

    expect(result.data).toHaveLength(2)
    expect(result.count).toBe(5)
  })

  it('uses followed_topics from preferences for scoring', async () => {
    const stories = [
      makeStoryRow({ id: 'a', topic: 'politics' }),
      makeStoryRow({ id: 'b', topic: 'sports' }),
    ]
    const client = createMockClient(stories)

    mockQueryPreferences.mockResolvedValue({
      id: 'pref-1',
      user_id: 'user-1',
      followed_topics: ['sports'],
      default_region: 'us',
      default_perspective: 'all',
      factuality_minimum: 'mixed',
      blindspot_digest_enabled: false,
      created_at: '',
      updated_at: '',
    })
    mockQueryReadStoryIds.mockResolvedValue([])

    const result = await queryForYouStories(
      client as never,
      'user-1',
      { page: 1, limit: 20 }
    )

    // Sports story should rank higher because it matches followed topic
    expect(result.data[0].topic).toBe('sports')
  })

  it('computes blindspots when user has reading history', async () => {
    const stories = [makeStoryRow({ id: 'a' })]
    const client = createMockClient(stories)

    mockQueryPreferences.mockResolvedValue({
      id: 'pref-1',
      user_id: 'user-1',
      followed_topics: [],
      default_region: 'us',
      default_perspective: 'all',
      factuality_minimum: 'mixed',
      blindspot_digest_enabled: false,
      created_at: '',
      updated_at: '',
    })
    mockQueryReadStoryIds.mockResolvedValue(['a'])
    mockComputeBiasProfile.mockReturnValue({
      userDistribution: [],
      overallDistribution: [],
      blindspots: ['far-right'],
      totalStoriesRead: 1,
      dominantBias: 'center',
    })

    await queryForYouStories(
      client as never,
      'user-1',
      { page: 1, limit: 20 }
    )

    expect(mockComputeBiasProfile).toHaveBeenCalled()
  })

  it('throws when candidate query fails', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB connection failed' },
      }),
    }
    const client = { from: vi.fn().mockReturnValue(query) }

    mockQueryPreferences.mockResolvedValue({
      id: 'pref-1',
      user_id: 'user-1',
      followed_topics: [],
      default_region: 'us',
      default_perspective: 'all',
      factuality_minimum: 'mixed',
      blindspot_digest_enabled: false,
      created_at: '',
      updated_at: '',
    })
    mockQueryReadStoryIds.mockResolvedValue([])

    await expect(
      queryForYouStories(
        client as never,
        'user-1',
        { page: 1, limit: 20 }
      )
    ).rejects.toThrow('Failed to fetch candidate stories')
  })
})
