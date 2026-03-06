/**
 * Tests for app/api/reading-history/[storyId]/route.ts (POST + DELETE)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/reading-history-queries', () => ({
  upsertReadingHistory: vi.fn(),
  markAsUnread: vi.fn(),
}))

import { POST, DELETE } from '@/app/api/reading-history/[storyId]/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { upsertReadingHistory, markAsUnread } from '@/lib/api/reading-history-queries'

const mockGetAuth = vi.mocked(getAuthenticatedUser)
const mockUpsert = vi.mocked(upsertReadingHistory)
const mockMarkUnread = vi.mocked(markAsUnread)

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

describe('POST /api/reading-history/[storyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const res = await POST(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(401)
  })

  it('validates storyId param — rejects invalid UUID', async () => {
    mockAuthenticated()
    const res = await POST(new Request('http://localhost'), createParams('bad-id'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid story ID')
  })

  it('marks story as read and returns success', async () => {
    mockAuthenticated()
    mockUpsert.mockResolvedValue(undefined)

    const res = await POST(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith(expect.anything(), 'user-1', VALID_UUID)
  })

  it('returns 500 on upsert error', async () => {
    mockAuthenticated()
    mockUpsert.mockRejectedValue(new Error('Upsert failed'))

    const res = await POST(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Upsert failed')
  })
})

describe('DELETE /api/reading-history/[storyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const res = await DELETE(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(401)
  })

  it('validates storyId param — rejects invalid UUID', async () => {
    mockAuthenticated()
    const res = await DELETE(new Request('http://localhost'), createParams('bad-id'))
    expect(res.status).toBe(400)
  })

  it('marks story as unread and returns success', async () => {
    mockAuthenticated()
    mockMarkUnread.mockResolvedValue(undefined)

    const res = await DELETE(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockMarkUnread).toHaveBeenCalledWith(expect.anything(), 'user-1', VALID_UUID)
  })

  it('returns 500 on delete error', async () => {
    mockAuthenticated()
    mockMarkUnread.mockRejectedValue(new Error('Delete failed'))

    const res = await DELETE(new Request('http://localhost'), createParams(VALID_UUID))
    expect(res.status).toBe(500)
  })
})
