/**
 * Tests for GET /api/tags/promoted — Promoted tags endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/query-helpers', () => ({
  queryPromotedTags: vi.fn(),
  PROMOTED_TAG_THRESHOLD: 3,
  PROMOTED_TAG_LIMIT: 15,
}))

import { GET } from '@/app/api/tags/promoted/route'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryPromotedTags } from '@/lib/api/query-helpers'

const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQueryPromotedTags = vi.mocked(queryPromotedTags)

const mockTagRows = [
  { id: 't1', slug: 'donald-trump', label: 'Donald Trump', description: null, tag_type: 'person', story_count: 47, created_at: '2026-01-01T00:00:00Z' },
  { id: 't2', slug: 'nato', label: 'NATO', description: null, tag_type: 'organization', story_count: 23, created_at: '2026-01-01T00:00:00Z' },
]

describe('GET /api/tags/promoted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue({} as never)
  })

  it('returns promoted tags with default params', async () => {
    mockQueryPromotedTags.mockResolvedValue(mockTagRows)

    const request = new NextRequest(new URL('http://localhost/api/tags/promoted'))
    const response = await GET(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].slug).toBe('donald-trump')
    expect(body.data[0].type).toBe('person')
    expect(body.data[0].storyCount).toBe(47)
    expect(mockQueryPromotedTags).toHaveBeenCalledWith(
      expect.anything(),
      { threshold: undefined, limit: undefined }
    )
  })

  it('passes custom threshold and limit', async () => {
    mockQueryPromotedTags.mockResolvedValue([])

    const request = new NextRequest(new URL('http://localhost/api/tags/promoted?threshold=10&limit=5'))
    await GET(request)

    expect(mockQueryPromotedTags).toHaveBeenCalledWith(
      expect.anything(),
      { threshold: 10, limit: 5 }
    )
  })

  it('returns 400 for invalid threshold', async () => {
    const request = new NextRequest(new URL('http://localhost/api/tags/promoted?threshold=abc'))
    const response = await GET(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('threshold')
  })

  it('returns 400 for invalid limit', async () => {
    const request = new NextRequest(new URL('http://localhost/api/tags/promoted?limit=0'))
    const response = await GET(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('limit')
  })

  it('returns 400 for partially numeric threshold "3abc"', async () => {
    const request = new NextRequest(new URL('http://localhost/api/tags/promoted?threshold=3abc'))
    const response = await GET(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('threshold')
  })

  it('returns 400 for limit exceeding max (999)', async () => {
    const request = new NextRequest(new URL('http://localhost/api/tags/promoted?limit=999'))
    const response = await GET(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('limit')
  })

  it('empty threshold param uses default', async () => {
    mockQueryPromotedTags.mockResolvedValue(mockTagRows)

    const request = new NextRequest(new URL('http://localhost/api/tags/promoted?threshold='))
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockQueryPromotedTags).toHaveBeenCalledWith(
      expect.anything(),
      { threshold: undefined, limit: undefined }
    )
  })

  it('empty limit param uses default', async () => {
    mockQueryPromotedTags.mockResolvedValue(mockTagRows)

    const request = new NextRequest(new URL('http://localhost/api/tags/promoted?limit='))
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockQueryPromotedTags).toHaveBeenCalledWith(
      expect.anything(),
      { threshold: undefined, limit: undefined }
    )
  })

  it('returns 500 on query error', async () => {
    mockQueryPromotedTags.mockRejectedValue(new Error('DB error'))

    const request = new NextRequest(new URL('http://localhost/api/tags/promoted'))
    const response = await GET(request)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('DB error')
  })
})
