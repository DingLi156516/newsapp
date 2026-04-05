/**
 * Tests for app/api/admin/sources/discover-rss/route.ts (POST)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/rss/discover', () => ({
  validatePublicUrl: vi.fn(),
  discoverRssFeeds: vi.fn(),
}))

import { POST } from '@/app/api/admin/sources/discover-rss/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { validatePublicUrl, discoverRssFeeds } from '@/lib/rss/discover'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockValidatePublicUrl = vi.mocked(validatePublicUrl)
const mockDiscoverFeeds = vi.mocked(discoverRssFeeds)

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/sources/discover-rss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/sources/discover-rss', () => {
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

    const res = await POST(makePostRequest({ url: 'https://example.com' }))
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

    const res = await POST(makePostRequest({ url: 'https://example.com' }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with discovered feeds', async () => {
    const mockFeeds = [
      { url: 'https://example.com/rss', source: 'html-link' as const, title: 'Main Feed' },
      { url: 'https://example.com/feed', source: 'common-path' as const },
    ]

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockDiscoverFeeds.mockResolvedValue(mockFeeds)

    const res = await POST(makePostRequest({ url: 'https://example.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockFeeds)
    expect(json.data).toHaveLength(2)
  })

  it('passes url to discoverRssFeeds', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockDiscoverFeeds.mockResolvedValue([])

    await POST(makePostRequest({ url: 'https://reuters.com' }))

    expect(mockDiscoverFeeds).toHaveBeenCalledWith('https://reuters.com')
  })

  it('returns 200 with empty array when no feeds found', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockDiscoverFeeds.mockResolvedValue([])

    const res = await POST(makePostRequest({ url: 'https://no-feeds.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns 400 for invalid URL', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makePostRequest({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 400 for missing url field', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makePostRequest({}))
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

    const req = new NextRequest('http://localhost/api/admin/sources/discover-rss', {
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

  it('returns 400 when URL targets private network (SSRF)', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockValidatePublicUrl.mockImplementationOnce(() => {
      throw new Error('URL targets a private or reserved network address')
    })

    const res = await POST(makePostRequest({ url: 'http://169.254.169.254' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('URL targets a private or reserved network address')
  })

  it('returns 500 on discovery error', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockDiscoverFeeds.mockRejectedValue(new Error('Network timeout'))

    const res = await POST(makePostRequest({ url: 'https://example.com' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Network timeout')
  })
})
