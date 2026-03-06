/**
 * Tests for app/api/preferences/route.ts (GET + PATCH)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api/preferences-queries', () => ({
  queryPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}))

import { GET, PATCH } from '@/app/api/preferences/route'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { queryPreferences, updatePreferences } from '@/lib/api/preferences-queries'

const mockGetAuth = vi.mocked(getAuthenticatedUser)
const mockQueryPrefs = vi.mocked(queryPreferences)
const mockUpdatePrefs = vi.mocked(updatePreferences)

const DEFAULT_PREFS = {
  followed_topics: [],
  default_perspective: 'all',
  factuality_minimum: 'mixed',
}

function mockUnauthenticated() {
  mockGetAuth.mockResolvedValue({
    user: null,
    error: 'Not authenticated',
    supabase: {} as never,
  })
}

function mockAuthenticated() {
  mockGetAuth.mockResolvedValue({
    user: { id: 'user-1' } as never,
    error: null,
    supabase: {} as never,
  })
}

function createPatchRequest(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/preferences'), {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns preferences (auto-creates if missing)', async () => {
    mockAuthenticated()
    mockQueryPrefs.mockResolvedValue(DEFAULT_PREFS as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, data: DEFAULT_PREFS })
  })

  it('returns 500 on query error', async () => {
    mockAuthenticated()
    mockQueryPrefs.mockRejectedValue(new Error('DB error'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB error')
  })
})

describe('PATCH /api/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const req = createPatchRequest({ default_perspective: 'left' })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('validates request body — rejects invalid fields', async () => {
    mockAuthenticated()
    const req = createPatchRequest({ default_perspective: 'extreme' })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('updates preferences and returns updated data', async () => {
    mockAuthenticated()
    const updated = { ...DEFAULT_PREFS, default_perspective: 'left' }
    mockQueryPrefs.mockResolvedValue(DEFAULT_PREFS as never)
    mockUpdatePrefs.mockResolvedValue(updated as never)

    const req = createPatchRequest({ default_perspective: 'left' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, data: updated })
    expect(mockUpdatePrefs).toHaveBeenCalledWith(expect.anything(), 'user-1', { default_perspective: 'left' })
  })

  it('returns 500 on update error', async () => {
    mockAuthenticated()
    mockQueryPrefs.mockResolvedValue(DEFAULT_PREFS as never)
    mockUpdatePrefs.mockRejectedValue(new Error('Update failed'))

    const req = createPatchRequest({ followed_topics: ['politics'] })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Update failed')
  })
})
