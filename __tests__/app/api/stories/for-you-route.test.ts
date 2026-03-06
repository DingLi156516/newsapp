/**
 * Tests for app/api/stories/for-you/route.ts (GET)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/for-you-queries', () => ({
  queryForYouStories: vi.fn(),
}))

import { GET } from '@/app/api/stories/for-you/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { queryForYouStories } from '@/lib/api/for-you-queries'

const mockGetAuth = vi.mocked(getAuthenticatedUser)
const mockQueryForYou = vi.mocked(queryForYouStories)

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/stories/for-you')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

describe('GET /api/stories/for-you', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: {} as never,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 200 with ranked stories for authenticated user', async () => {
    const mockStories = [
      { id: 'story-1', headline: 'Top Story', topic: 'politics' },
    ]

    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: {} as never,
    })

    mockQueryForYou.mockResolvedValue({
      data: mockStories as never,
      count: 1,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockStories)
    expect(json.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('passes query params to queryForYouStories', async () => {
    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: {} as never,
    })

    mockQueryForYou.mockResolvedValue({ data: [], count: 0 })

    await GET(makeRequest({ page: '2', limit: '10' }))

    expect(mockQueryForYou).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { page: 2, limit: 10 }
    )
  })

  it('returns 400 for invalid query params', async () => {
    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: {} as never,
    })

    const res = await GET(makeRequest({ limit: '-5' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 500 when query throws', async () => {
    mockGetAuth.mockResolvedValue({
      user: { id: 'user-1' } as never,
      error: null,
      supabase: {} as never,
    })

    mockQueryForYou.mockRejectedValue(new Error('DB error'))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('DB error')
  })
})
