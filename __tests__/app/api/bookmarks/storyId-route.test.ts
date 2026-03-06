/**
 * Tests for app/api/bookmarks/[storyId]/route.ts (DELETE)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/bookmark-queries', () => ({
  deleteBookmark: vi.fn(),
}))

import { DELETE } from '@/app/api/bookmarks/[storyId]/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { deleteBookmark } from '@/lib/api/bookmark-queries'

const mockGetAuth = vi.mocked(getAuthenticatedUser)
const mockDeleteBookmark = vi.mocked(deleteBookmark)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

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

function createParams(storyId: string) {
  return { params: Promise.resolve({ storyId }) }
}

describe('DELETE /api/bookmarks/[storyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const res = await DELETE(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('validates storyId param — rejects invalid UUID', async () => {
    mockAuthenticated()
    const res = await DELETE(new Request('http://localhost'), createParams('not-a-uuid'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('removes bookmark and returns success', async () => {
    mockAuthenticated()
    mockDeleteBookmark.mockResolvedValue(undefined)

    const res = await DELETE(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockDeleteBookmark).toHaveBeenCalledWith(expect.anything(), 'user-1', VALID_UUID)
  })

  it('returns 500 on delete error', async () => {
    mockAuthenticated()
    mockDeleteBookmark.mockRejectedValue(new Error('Delete failed'))

    const res = await DELETE(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Delete failed')
  })
})
