/**
 * Tests for app/api/admin/review/route.ts (GET) and
 * app/api/admin/review/[id]/route.ts (PATCH)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/api/review-queries', () => ({
  queryReviewQueue: vi.fn(),
  updateReviewStatus: vi.fn(),
}))

import { GET } from '@/app/api/admin/review/route'
import { PATCH } from '@/app/api/admin/review/[id]/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { queryReviewQueue, updateReviewStatus } from '@/lib/api/review-queries'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockQueryQueue = vi.mocked(queryReviewQueue)
const mockUpdateStatus = vi.mocked(updateReviewStatus)

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/review')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/review/story-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/review', () => {
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

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 403 when not admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with review queue for admin', async () => {
    const mockStories = [
      { id: 'story-1', headline: 'Pending Story', review_status: 'pending' },
    ]

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockQueryQueue.mockResolvedValue({
      data: mockStories as never,
      count: 1,
    })

    const res = await GET(makeGetRequest({ status: 'pending' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockStories)
    expect(json.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('returns 400 for invalid query params', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await GET(makeGetRequest({ status: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 on query error', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockQueryQueue.mockRejectedValue(new Error('DB crash'))

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/admin/review/[id]', () => {
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

    const res = await PATCH(makePatchRequest({ action: 'approve' }), {
      params: Promise.resolve({ id: 'story-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const res = await PATCH(makePatchRequest({ action: 'approve' }), {
      params: Promise.resolve({ id: 'story-1' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 200 on successful approve', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateStatus.mockResolvedValue(undefined)

    const res = await PATCH(makePatchRequest({ action: 'approve' }), {
      params: Promise.resolve({ id: 'story-1' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 400 for invalid action', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await PATCH(makePatchRequest({ action: 'delete' }), {
      params: Promise.resolve({ id: 'story-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('passes edits to updateReviewStatus', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateStatus.mockResolvedValue(undefined)

    const body = {
      action: 'approve',
      headline: 'Edited',
      ai_summary: {
        commonGround: 'CG',
        leftFraming: 'LF',
        rightFraming: 'RF',
      },
    }

    await PATCH(makePatchRequest(body), {
      params: Promise.resolve({ id: 'story-1' }),
    })

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      expect.anything(),
      'story-1',
      'admin-1',
      expect.objectContaining({
        action: 'approve',
        headline: 'Edited',
      })
    )
  })

  it('returns 500 on update error', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateStatus.mockRejectedValue(new Error('DB crash'))

    const res = await PATCH(makePatchRequest({ action: 'approve' }), {
      params: Promise.resolve({ id: 'story-1' }),
    })
    expect(res.status).toBe(500)
  })
})
