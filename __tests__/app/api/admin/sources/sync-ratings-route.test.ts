/**
 * Tests for app/api/admin/sources/sync-ratings/route.ts (POST).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({ __serviceClient: true })),
}))

vi.mock('@/lib/api/bias-sync-queries', () => ({
  syncProviderRatings: vi.fn(),
}))

import { POST } from '@/app/api/admin/sources/sync-ratings/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { syncProviderRatings } from '@/lib/api/bias-sync-queries'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockSync = vi.mocked(syncProviderRatings)

describe('POST /api/admin/sources/sync-ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await POST()
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

    const res = await POST()
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with sync result on success', async () => {
    const syncResult = {
      updated: 12,
      skipped: 3,
      errors: 0,
    }

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })
    mockSync.mockResolvedValue(syncResult as never)

    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(syncResult)
  })

  it('uses the service-role client for sync', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })
    mockSync.mockResolvedValue({ updated: 0, skipped: 0, errors: 0 } as never)

    await POST()

    const firstArg = mockSync.mock.calls[0][0] as { __serviceClient?: boolean }
    expect(firstArg.__serviceClient).toBe(true)
  })

  it('returns 500 on sync failure', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })
    mockSync.mockRejectedValue(new Error('Provider API rate limited'))

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('Provider API rate limited')
  })
})
