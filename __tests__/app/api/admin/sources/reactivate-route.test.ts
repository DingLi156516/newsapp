/**
 * Tests for app/api/admin/sources/[id]/reactivate/route.ts (POST).
 *
 * The route uses a UPDATE-first, SELECT-fallback flow:
 *   1. UPDATE ... WHERE id = ? AND (auto_disabled_at IS NOT NULL OR cooldown_until > now())
 *   2. If 0 rows matched, SELECT by id to distinguish 404 from noop (already healthy).
 *
 * Tests assert both phases dispatch correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

import { POST } from '@/app/api/admin/sources/[id]/reactivate/route'
import { getAdminUser } from '@/lib/api/admin-helpers'

const mockGetAdmin = vi.mocked(getAdminUser)

const VALID_UUID = '00000000-0000-4000-8000-000000000001'

function makeRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/sources/${VALID_UUID}/reactivate`,
    { method: 'POST' }
  )
}

interface SupabaseMocks {
  supabase: { from: ReturnType<typeof vi.fn> }
  updateBuilder: {
    update: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  }
  selectBuilder: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  }
}

function makeSupabase(options: {
  updateResult?: { data: { id: string } | null; error: { message: string } | null }
  fallbackResult?: { data: { id: string } | null; error: { message: string } | null }
}): SupabaseMocks {
  const updateBuilder = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      options.updateResult ?? { data: null, error: null }
    ),
  }

  const selectBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      options.fallbackResult ?? { data: null, error: null }
    ),
  }

  let callCount = 0
  const from = vi.fn().mockImplementation(() => {
    callCount += 1
    return callCount === 1 ? updateBuilder : selectBuilder
  })

  return { supabase: { from }, updateBuilder, selectBuilder }
}

describe('POST /api/admin/sources/[id]/reactivate', () => {
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

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
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

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 for non-UUID id', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: {} as never,
    })

    const req = new NextRequest(
      'http://localhost/api/admin/sources/not-a-uuid/reactivate',
      { method: 'POST' }
    )
    const res = await POST(req, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 on happy path and applies conditional UPDATE with OR filter', async () => {
    const { supabase, updateBuilder, selectBuilder } = makeSupabase({
      updateResult: { data: { id: VALID_UUID }, error: null },
    })

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: supabase as never,
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: VALID_UUID }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(VALID_UUID)
    expect(typeof json.data.reactivatedAt).toBe('string')
    expect(json.data.noop).toBeUndefined()

    // Verify the UPDATE payload clears all health columns.
    expect(updateBuilder.update).toHaveBeenCalledTimes(1)
    const patch = updateBuilder.update.mock.calls[0][0]
    expect(patch.cooldown_until).toBeNull()
    expect(patch.auto_disabled_at).toBeNull()
    expect(patch.auto_disabled_reason).toBeNull()
    expect(patch.consecutive_failures).toBe(0)
    expect(patch.last_fetch_error).toBeNull()

    // Verify the WHERE-chain: eq('id', ...) AND or(not-null / gt now)
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', VALID_UUID)
    expect(updateBuilder.or).toHaveBeenCalledTimes(1)
    const orFilter = updateBuilder.or.mock.calls[0][0]
    expect(orFilter).toMatch(/^auto_disabled_at\.not\.is\.null,cooldown_until\.gt\./)

    // Happy path never needs the fallback read.
    expect(selectBuilder.maybeSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when UPDATE matches zero rows AND fallback SELECT returns nothing', async () => {
    const { supabase, selectBuilder } = makeSupabase({
      updateResult: { data: null, error: null },
      fallbackResult: { data: null, error: null },
    })

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: supabase as never,
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Source not found')
    expect(selectBuilder.eq).toHaveBeenCalledWith('id', VALID_UUID)
  })

  it('returns 200 with noop=true when UPDATE matches zero rows but the source exists (already healthy)', async () => {
    const { supabase, updateBuilder } = makeSupabase({
      updateResult: { data: null, error: null },
      fallbackResult: { data: { id: VALID_UUID }, error: null },
    })

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: supabase as never,
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: VALID_UUID }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.noop).toBe(true)
    // UPDATE was still attempted once
    expect(updateBuilder.update).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on UPDATE database error', async () => {
    const { supabase } = makeSupabase({
      updateResult: { data: null, error: { message: 'connection refused' } },
    })

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: supabase as never,
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('connection refused')
  })

  it('returns 500 on fallback SELECT database error', async () => {
    const { supabase } = makeSupabase({
      updateResult: { data: null, error: null },
      fallbackResult: { data: null, error: { message: 'lookup crashed' } },
    })

    mockGetAdmin.mockResolvedValue({
      user: { id: 'admin-1' } as never,
      isAdmin: true,
      error: null,
      supabase: supabase as never,
    })

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('lookup crashed')
  })
})
