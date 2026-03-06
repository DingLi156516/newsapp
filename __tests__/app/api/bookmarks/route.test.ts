/**
 * Tests for app/api/bookmarks/route.ts (GET + POST)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/bookmark-queries', () => ({
  queryBookmarks: vi.fn(),
  insertBookmark: vi.fn(),
}))

import { GET, POST } from '@/app/api/bookmarks/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { queryBookmarks, insertBookmark } from '@/lib/api/bookmark-queries'

const mockGetAuth = vi.mocked(getAuthenticatedUser)
const mockQueryBookmarks = vi.mocked(queryBookmarks)
const mockInsertBookmark = vi.mocked(insertBookmark)

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

function createPostRequest(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/bookmarks'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/bookmarks', () => {
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

  it('returns bookmark story IDs for authenticated user', async () => {
    mockAuthenticated()
    mockQueryBookmarks.mockResolvedValue({ storyIds: ['id-1', 'id-2'] })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, data: ['id-1', 'id-2'] })
  })

  it('returns 500 on query error', async () => {
    mockAuthenticated()
    mockQueryBookmarks.mockRejectedValue(new Error('DB connection failed'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB connection failed')
  })
})

describe('POST /api/bookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const req = createPostRequest({ storyId: VALID_UUID })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('validates storyId — rejects invalid UUID with 400', async () => {
    mockAuthenticated()
    const req = createPostRequest({ storyId: 'not-a-uuid' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('creates bookmark and returns success', async () => {
    mockAuthenticated()
    mockInsertBookmark.mockResolvedValue(undefined)

    const req = createPostRequest({ storyId: VALID_UUID })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockInsertBookmark).toHaveBeenCalledWith(expect.anything(), 'user-1', VALID_UUID)
  })

  it('returns 500 on insert error', async () => {
    mockAuthenticated()
    mockInsertBookmark.mockRejectedValue(new Error('Insert failed'))

    const req = createPostRequest({ storyId: VALID_UUID })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Insert failed')
  })
})
