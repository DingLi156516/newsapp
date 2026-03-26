/**
 * Tests for app/api/dashboard/bias-profile/route.ts (GET)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/bias-calculator', () => ({
  computeBiasProfile: vi.fn(),
}))

import { GET } from '@/app/api/dashboard/bias-profile/route'
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

describe('GET /api/dashboard/bias-profile', () => {
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

  it('returns computed bias profile with empty reading history', async () => {
    const mockProfile = {
      userDistribution: [],
      overallDistribution: [],
      blindspots: [],
      totalStoriesRead: 0,
      dominantBias: null,
    }

    // Create a supabase mock that returns empty history, then all stories
    const supabase = {
      from: vi.fn(),
    }

    // reading_history query chain
    const historyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    // Resolve to empty array for .eq('is_read', true)
    historyChain.eq.mockReturnValueOnce(historyChain).mockResolvedValueOnce({
      data: [],
      error: null,
    })
    historyChain.select.mockReturnValue(historyChain)

    // all stories query chain
    const allStoriesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ spectrum_segments: [{ bias: 'center', percentage: 100 }] }],
        error: null,
      }),
    }

    supabase.from
      .mockReturnValueOnce(historyChain)  // reading_history
      .mockReturnValueOnce(allStoriesChain)  // stories (all)

    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: supabase as never,
    })

    mockComputeBias.mockReturnValue(mockProfile as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockProfile)
  })

  it('returns computed bias profile with reading data', async () => {
    const mockProfile = {
      userDistribution: [{ bias: 'left', percentage: 60 }, { bias: 'center', percentage: 40 }],
      overallDistribution: [{ bias: 'left', percentage: 30 }, { bias: 'center', percentage: 70 }],
      blindspots: ['right'],
      totalStoriesRead: 5,
      dominantBias: 'left',
    }

    const supabase = {
      from: vi.fn(),
    }

    // reading_history returns story IDs
    const historyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    historyChain.eq.mockReturnValueOnce(historyChain).mockResolvedValueOnce({
      data: [{ story_id: 'story-1' }, { story_id: 'story-2' }],
      error: null,
    })
    historyChain.select.mockReturnValue(historyChain)

    // user stories query
    const userStoriesChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { spectrum_segments: [{ bias: 'left', percentage: 60 }, { bias: 'center', percentage: 40 }] },
        ],
        error: null,
      }),
    }

    // all stories query
    const allStoriesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { spectrum_segments: [{ bias: 'center', percentage: 100 }] },
        ],
        error: null,
      }),
    }

    supabase.from
      .mockReturnValueOnce(historyChain)       // reading_history
      .mockReturnValueOnce(userStoriesChain)    // stories (user's)
      .mockReturnValueOnce(allStoriesChain)     // stories (all)

    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: supabase as never,
    })

    mockComputeBias.mockReturnValue(mockProfile as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual(mockProfile)
    expect(mockComputeBias).toHaveBeenCalled()
  })

  it('returns 500 on query error', async () => {
    const supabase = {
      from: vi.fn(),
    }

    const historyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    historyChain.eq.mockReturnValueOnce(historyChain).mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection refused' },
    })
    historyChain.select.mockReturnValue(historyChain)

    supabase.from.mockReturnValueOnce(historyChain)

    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: supabase as never,
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Connection refused')
  })
})
