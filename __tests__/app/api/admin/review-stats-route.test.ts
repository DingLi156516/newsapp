/**
 * Tests for app/api/admin/review/stats/route.ts (GET)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/api/review-queries', () => ({
  queryReviewStats: vi.fn(),
}))

import { GET } from '@/app/api/admin/review/stats/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { queryReviewStats } from '@/lib/api/review-queries'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockQueryStats = vi.mocked(queryReviewStats)

describe('GET /api/admin/review/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 200 with stats for admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockQueryStats.mockResolvedValue({
      pending: 10,
      approved: 50,
      rejected: 3,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ pending: 10, approved: 50, rejected: 3 })
  })

  it('returns 500 on query error', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockQueryStats.mockRejectedValue(new Error('DB crash'))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
