/**
 * Tests for app/api/admin/sources/[id]/route.ts (PATCH)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/api/source-admin-queries', () => ({
  updateSource: vi.fn(),
}))

import { PATCH } from '@/app/api/admin/sources/[id]/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { updateSource } from '@/lib/api/source-admin-queries'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockUpdateSource = vi.mocked(updateSource)

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/sources/source-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/sources/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validUpdate = { name: 'Updated Source Name' }

  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await PATCH(makePatchRequest(validUpdate), {
      params: Promise.resolve({ id: 'source-1' }),
    })
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

    const res = await PATCH(makePatchRequest(validUpdate), {
      params: Promise.resolve({ id: 'source-1' }),
    })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with updated source', async () => {
    const updatedSource = { id: 'source-1', name: 'Updated Source Name', slug: 'updated-source' }

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateSource.mockResolvedValue(updatedSource as never)

    const res = await PATCH(makePatchRequest(validUpdate), {
      params: Promise.resolve({ id: 'source-1' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(updatedSource)
  })

  it('passes correct id and data to updateSource', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateSource.mockResolvedValue({ id: 'source-1' } as never)

    const body = { name: 'New Name', bias: 'center' as const, is_active: false }
    await PATCH(makePatchRequest(body), {
      params: Promise.resolve({ id: 'source-1' }),
    })

    expect(mockUpdateSource).toHaveBeenCalledWith(
      expect.anything(),
      'source-1',
      expect.objectContaining({ name: 'New Name', bias: 'center', is_active: false })
    )
  })

  it('returns 400 for invalid body', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await PATCH(
      makePatchRequest({ bias: 'not-a-valid-bias' }),
      { params: Promise.resolve({ id: 'source-1' }) }
    )
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

    const req = new NextRequest('http://localhost/api/admin/sources/source-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'source-1' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 404 when source not found', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateSource.mockRejectedValue(new Error('Source not found'))

    const res = await PATCH(makePatchRequest(validUpdate), {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Source not found')
  })

  it('returns 409 when slug already exists', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateSource.mockRejectedValue(
      new Error('A source with that slug already exists')
    )

    const res = await PATCH(
      makePatchRequest({ slug: 'duplicate-slug' }),
      { params: Promise.resolve({ id: 'source-1' }) }
    )
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('already exists')
  })

  it('returns 500 on unexpected error', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    mockUpdateSource.mockRejectedValue(new Error('DB crash'))

    const res = await PATCH(makePatchRequest(validUpdate), {
      params: Promise.resolve({ id: 'source-1' }),
    })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('DB crash')
  })
})
