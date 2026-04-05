/**
 * Tests for app/api/admin/sources/route.ts (GET and POST)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/api/source-admin-queries', () => ({
  queryAdminSources: vi.fn(),
  createSource: vi.fn(),
}))

import { GET, POST } from '@/app/api/admin/sources/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { queryAdminSources, createSource } from '@/lib/api/source-admin-queries'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockQuerySources = vi.mocked(queryAdminSources)
const mockCreateSource = vi.mocked(createSource)

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/sources')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/sources', () => {
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
    expect(json.error).toBe('Unauthorized')
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
    expect(json.success).toBe(false)
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with data and meta for admin', async () => {
    const mockSources = [
      { id: 'src-1', name: 'CNN', slug: 'cnn', bias: 'lean-left' },
      { id: 'src-2', name: 'Fox News', slug: 'fox-news', bias: 'right' },
    ]

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockQuerySources.mockResolvedValue({
      data: mockSources as never,
      count: 2,
    })

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockSources)
    expect(json.meta).toEqual({ total: 2, page: 1, limit: 50 })
  })

  it('returns 400 for invalid query params', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await GET(makeGetRequest({ bias: 'not-a-bias' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('passes search and filter params to query', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockQuerySources.mockResolvedValue({ data: [] as never, count: 0 })

    await GET(makeGetRequest({ search: 'cnn', bias: 'center', page: '2', limit: '10' }))

    expect(mockQuerySources).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        search: 'cnn',
        bias: 'center',
        page: 2,
        limit: 10,
      })
    )
  })

  it('returns 500 on query error', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockQuerySources.mockRejectedValue(new Error('DB crash'))

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('DB crash')
  })
})

describe('POST /api/admin/sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validBody = {
    name: 'Reuters',
    bias: 'center',
    factuality: 'very-high',
    ownership: 'corporate',
    url: 'https://reuters.com',
    rss_url: 'https://reuters.com/rss',
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when not admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Forbidden')
  })

  it('returns 201 with created source', async () => {
    const createdSource = { id: 'src-new', name: 'Reuters', slug: 'reuters' }

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockCreateSource.mockResolvedValue(createdSource as never)

    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(createdSource)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makePostRequest({ name: '' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 400 for invalid JSON', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const req = new NextRequest('http://localhost/api/admin/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 409 when slug already exists', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockCreateSource.mockRejectedValue(
      new Error('A source with slug "reuters" already exists')
    )

    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('already exists')
  })
})
