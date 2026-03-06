/**
 * Tests for app/api/dashboard/suggestions/route.ts (GET)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/bias-calculator', () => ({
  computeBiasProfile: vi.fn(),
}))

vi.mock('@/lib/api/transformers', () => ({
  transformStoryList: vi.fn((story: Record<string, unknown>) => ({
    id: story.id,
    headline: story.headline,
    topic: story.topic,
  })),
}))

import { GET } from '@/app/api/dashboard/suggestions/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { computeBiasProfile } from '@/lib/api/bias-calculator'

const mockGetAuth = vi.mocked(getAuthenticatedUser)
const mockComputeBias = vi.mocked(computeBiasProfile)

function mockUnauthenticated() {
  mockGetAuth.mockResolvedValue({
    user: null,
    error: 'Not authenticated',
    supabase: {} as never,
  })
}

describe('GET /api/dashboard/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns empty array when no blindspots', async () => {
    const supabase = { from: vi.fn() }

    // reading_history — empty
    const historyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    historyChain.eq.mockReturnValueOnce(historyChain).mockResolvedValueOnce({
      data: [],
      error: null,
    })
    historyChain.select.mockReturnValue(historyChain)

    // all stories query
    const allStoriesChain = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'story-1',
            headline: 'Story 1',
            topic: 'politics',
            spectrum_segments: [{ bias: 'center', percentage: 100 }],
          },
        ],
        error: null,
      }),
    }

    supabase.from
      .mockReturnValueOnce(historyChain)
      .mockReturnValueOnce(allStoriesChain)

    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: supabase as never,
    })

    mockComputeBias.mockReturnValue({
      userDistribution: [],
      overallDistribution: [],
      blindspots: [],
      totalStoriesRead: 0,
      dominantBias: null,
    } as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })

  it('returns stories from underrepresented categories', async () => {
    const supabase = { from: vi.fn() }

    // reading_history — user has read story-1
    const historyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    historyChain.eq.mockReturnValueOnce(historyChain).mockResolvedValueOnce({
      data: [{ story_id: 'story-1' }],
      error: null,
    })
    historyChain.select.mockReturnValue(historyChain)

    // user stories (for bias calc)
    const userStoriesChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ spectrum_segments: [{ bias: 'left', percentage: 100 }] }],
        error: null,
      }),
    }

    // all stories — includes unread story-2 with 50% right bias
    const allStoriesChain = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'story-1',
            headline: 'Already Read',
            topic: 'politics',
            spectrum_segments: [{ bias: 'left', percentage: 100 }],
          },
          {
            id: 'story-2',
            headline: 'Right Perspective',
            topic: 'world',
            spectrum_segments: [{ bias: 'right', percentage: 50 }, { bias: 'center', percentage: 50 }],
          },
        ],
        error: null,
      }),
    }

    supabase.from
      .mockReturnValueOnce(historyChain)
      .mockReturnValueOnce(userStoriesChain)
      .mockReturnValueOnce(allStoriesChain)

    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: supabase as never,
    })

    mockComputeBias.mockReturnValue({
      userDistribution: [{ bias: 'left', percentage: 100 }],
      overallDistribution: [{ bias: 'left', percentage: 50 }, { bias: 'right', percentage: 50 }],
      blindspots: ['right'],
      totalStoriesRead: 1,
      dominantBias: 'left',
    } as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    // story-2 has 50% right (blindspot) >= 30% threshold, not yet read
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe('story-2')
  })

  it('excludes already-read stories from suggestions', async () => {
    const supabase = { from: vi.fn() }

    // User has read both stories
    const historyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    historyChain.eq.mockReturnValueOnce(historyChain).mockResolvedValueOnce({
      data: [{ story_id: 'story-1' }, { story_id: 'story-2' }],
      error: null,
    })
    historyChain.select.mockReturnValue(historyChain)

    const userStoriesChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ spectrum_segments: [{ bias: 'left', percentage: 100 }] }],
        error: null,
      }),
    }

    const allStoriesChain = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'story-1',
            headline: 'Read Story 1',
            topic: 'politics',
            spectrum_segments: [{ bias: 'right', percentage: 100 }],
          },
          {
            id: 'story-2',
            headline: 'Read Story 2',
            topic: 'world',
            spectrum_segments: [{ bias: 'right', percentage: 100 }],
          },
        ],
        error: null,
      }),
    }

    supabase.from
      .mockReturnValueOnce(historyChain)
      .mockReturnValueOnce(userStoriesChain)
      .mockReturnValueOnce(allStoriesChain)

    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: supabase as never,
    })

    mockComputeBias.mockReturnValue({
      userDistribution: [{ bias: 'left', percentage: 100 }],
      overallDistribution: [{ bias: 'right', percentage: 100 }],
      blindspots: ['right'],
      totalStoriesRead: 2,
      dominantBias: 'left',
    } as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })
})
