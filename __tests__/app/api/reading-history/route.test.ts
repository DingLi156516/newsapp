/**
 * Tests for app/api/reading-history/route.ts (GET)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/reading-history-queries', () => ({
  queryReadStoryIds: vi.fn(),
}))

import { GET } from '@/app/api/reading-history/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { queryReadStoryIds } from '@/lib/api/reading-history-queries'

const mockGetAuth = vi.mocked(getAuthenticatedUser)
const mockQueryReadStoryIds = vi.mocked(queryReadStoryIds)

function mockUnauthenticated() {
  mockGetAuth.mockResolvedValue({
    user: null,
    error: 'Not authenticated',
    supabase: {} as never,
  })
}

function mockAuthenticated() {
  mockGetAuth.mockResolvedValue({
    user: { id: 'user-1' } as never,
    error: null,
    supabase: {} as never,
  })
}

describe('GET /api/reading-history', () => {
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

  it('returns read story IDs for authenticated user', async () => {
    mockAuthenticated()
    mockQueryReadStoryIds.mockResolvedValue(['id-1', 'id-2', 'id-3'])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, data: ['id-1', 'id-2', 'id-3'] })
  })

  it('returns 500 on query error', async () => {
    mockAuthenticated()
    mockQueryReadStoryIds.mockRejectedValue(new Error('Query failed'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Query failed')
  })
})
