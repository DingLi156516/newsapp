/**
 * Tests for GET /api/tags — Tag directory endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/query-helpers', () => ({
  queryTags: vi.fn(),
}))

import { GET } from '@/app/api/tags/route'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryTags } from '@/lib/api/query-helpers'

const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQueryTags = vi.mocked(queryTags)

describe('GET /api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue({} as never)
  })

  it('returns tags with pagination meta', async () => {
    mockQueryTags.mockResolvedValue({
      data: [
        { id: 't1', slug: 'iran', label: 'Iran', description: null, tag_type: 'location', story_count: 150, created_at: '2026-01-01T00:00:00Z' },
        { id: 't2', slug: 'donald-trump', label: 'Donald Trump', description: null, tag_type: 'person', story_count: 120, created_at: '2026-01-01T00:00:00Z' },
      ],
      count: 2,
    })

    const request = new NextRequest(new URL('http://localhost/api/tags'))
    const response = await GET(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].slug).toBe('iran')
    expect(body.data[0].type).toBe('location')
    expect(body.data[0].storyCount).toBe(150)
    expect(body.meta.total).toBe(2)
    expect(body.meta.page).toBe(1)
    expect(body.meta.limit).toBe(50)
  })

  it('passes type filter to query', async () => {
    mockQueryTags.mockResolvedValue({ data: [], count: 0 })

    const request = new NextRequest(new URL('http://localhost/api/tags?type=person'))
    await GET(request)

    expect(mockQueryTags).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'person' })
    )
  })

  it('passes search filter to query', async () => {
    mockQueryTags.mockResolvedValue({ data: [], count: 0 })

    const request = new NextRequest(new URL('http://localhost/api/tags?search=iran'))
    await GET(request)

    expect(mockQueryTags).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'iran' })
    )
  })

  it('returns 400 for invalid type', async () => {
    const request = new NextRequest(new URL('http://localhost/api/tags?type=invalid'))
    const response = await GET(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
  })

  it('returns 500 on query error', async () => {
    mockQueryTags.mockRejectedValue(new Error('DB error'))

    const request = new NextRequest(new URL('http://localhost/api/tags'))
    const response = await GET(request)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.success).toBe(false)
  })
})
