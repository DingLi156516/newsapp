/**
 * Tests for app/api/admin/maintenance/route.ts (POST).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({ __serviceClient: true })),
}))

vi.mock('@/lib/admin/pipeline-maintenance', () => ({
  purgeUnembeddedArticles: vi.fn(),
  purgeOrphanStories: vi.fn(),
  purgeExpiredArticles: vi.fn(),
}))

import { POST } from '@/app/api/admin/maintenance/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import {
  purgeUnembeddedArticles,
  purgeOrphanStories,
  purgeExpiredArticles,
} from '@/lib/admin/pipeline-maintenance'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockGetService = vi.mocked(getSupabaseServiceClient)
const mockPurgeUnembedded = vi.mocked(purgeUnembeddedArticles)
const mockPurgeOrphanStories = vi.mocked(purgeOrphanStories)
const mockPurgeExpired = vi.mocked(purgeExpiredArticles)

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/maintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await POST(makeRequest({ action: 'purge_unembedded_articles', dryRun: true }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'u1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makeRequest({ action: 'purge_unembedded_articles', dryRun: true }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const req = new NextRequest('http://localhost/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown action', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makeRequest({ action: 'drop_everything', dryRun: true }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when dryRun is missing', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makeRequest({ action: 'purge_orphan_stories' }))
    expect(res.status).toBe(400)
  })

  it('dispatches purge_unembedded_articles with triggeredBy and uses the SERVICE client', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: { __userClient: true } as never,
    })
    mockPurgeUnembedded.mockResolvedValue({
      action: 'purge_unembedded_articles',
      dryRun: true,
      deletedCount: 5,
      sampleIds: ['a1', 'a2'],
      auditId: 'audit-1',
    })

    const res = await POST(
      makeRequest({ action: 'purge_unembedded_articles', dryRun: true, olderThanDays: 14 })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.deletedCount).toBe(5)
    expect(json.data.sampleIds).toEqual(['a1', 'a2'])

    // Route must use the service-role client (the audit table + purge
    // RPCs are RLS-protected to service_role only).
    expect(mockGetService).toHaveBeenCalled()
    const firstArg = mockPurgeUnembedded.mock.calls[0][0] as { __serviceClient?: boolean }
    expect(firstArg.__serviceClient).toBe(true)

    expect(mockPurgeUnembedded).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dryRun: true,
        olderThanDays: 14,
        triggeredBy: 'admin-1',
      })
    )
  })

  it('dispatches purge_orphan_stories', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })
    mockPurgeOrphanStories.mockResolvedValue({
      action: 'purge_orphan_stories',
      dryRun: false,
      deletedCount: 1,
      sampleIds: ['s1'],
      auditId: 'audit-2',
    })

    const res = await POST(makeRequest({ action: 'purge_orphan_stories', dryRun: false }))
    expect(res.status).toBe(200)
    expect(mockPurgeOrphanStories).toHaveBeenCalledTimes(1)
  })

  it('dispatches purge_expired_articles', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })
    mockPurgeExpired.mockResolvedValue({
      action: 'purge_expired_articles',
      dryRun: true,
      deletedCount: 10,
      sampleIds: [],
      auditId: 'audit-3',
    })

    const res = await POST(makeRequest({ action: 'purge_expired_articles', dryRun: true }))
    expect(res.status).toBe(200)
    expect(mockPurgeExpired).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when the purge function throws', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })
    mockPurgeUnembedded.mockRejectedValue(new Error('db crash'))

    const res = await POST(makeRequest({ action: 'purge_unembedded_articles', dryRun: true }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('db crash')
  })
})
