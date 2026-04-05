/**
 * Tests for app/api/admin/sources/import/route.ts (POST)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/api/source-admin-queries', () => ({
  bulkCreateSources: vi.fn(),
}))

import { POST } from '@/app/api/admin/sources/import/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { bulkCreateSources } from '@/lib/api/source-admin-queries'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockBulkCreate = vi.mocked(bulkCreateSources)

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/sources/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validRow = {
  name: 'Reuters',
  bias: 'center',
  factuality: 'very-high',
  ownership: 'corporate',
  url: 'https://reuters.com',
  rss_url: 'https://reuters.com/rss',
}

describe('POST /api/admin/sources/import', () => {
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

    const res = await POST(makePostRequest({ rows: [validRow] }))
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

    const res = await POST(makePostRequest({ rows: [validRow] }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with inserted/skipped/errors counts', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockBulkCreate.mockResolvedValue({
      inserted: 2,
      skipped: 1,
      errors: [{ row: 2, reason: 'Duplicate slug: ap-news' }],
    })

    const rows = [
      validRow,
      { ...validRow, name: 'AP News' },
      { ...validRow, name: 'AP News Duplicate' },
    ]

    const res = await POST(makePostRequest({ rows }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.inserted).toBe(2)
    expect(json.data.skipped).toBe(1)
    expect(json.data.errors).toHaveLength(1)
    expect(json.data.errors[0].row).toBe(2)
  })

  it('passes rows to bulkCreateSources', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockBulkCreate.mockResolvedValue({ inserted: 1, skipped: 0, errors: [] })

    await POST(makePostRequest({ rows: [validRow] }))

    expect(mockBulkCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({ name: 'Reuters', bias: 'center' }),
      ])
    )
  })

  it('returns 400 for empty rows array', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makePostRequest({ rows: [] }))
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

    const req = new NextRequest('http://localhost/api/admin/sources/import', {
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

  it('returns 400 for missing rows field', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makePostRequest({ sources: [validRow] }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 500 on bulk create error', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockBulkCreate.mockRejectedValue(new Error('DB connection lost'))

    const res = await POST(makePostRequest({ rows: [validRow] }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('DB connection lost')
  })
})
