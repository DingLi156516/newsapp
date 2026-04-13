/**
 * Tests for app/api/admin/dlq/route.ts (GET + POST).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/admin-helpers', () => ({
  getAdminUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({ __serviceClient: true })),
}))

vi.mock('@/lib/pipeline/dead-letter', () => ({
  listUnreplayed: vi.fn(),
  replayDeadLetterEntry: vi.fn(),
  dismissDeadLetterEntry: vi.fn(),
}))

import { GET, POST } from '@/app/api/admin/dlq/route'
import { getAdminUser } from '@/lib/api/admin-helpers'
import {
  listUnreplayed,
  replayDeadLetterEntry,
  dismissDeadLetterEntry,
} from '@/lib/pipeline/dead-letter'

const mockGetAdmin = vi.mocked(getAdminUser)
const mockListUnreplayed = vi.mocked(listUnreplayed)
const mockReplay = vi.mocked(replayDeadLetterEntry)
const mockDismiss = vi.mocked(dismissDeadLetterEntry)

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/dlq')
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/dlq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/dlq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  })
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

function adminAuth() {
  mockGetAdmin.mockResolvedValue({
    user: { id: 'admin-1' } as never,
    isAdmin: true,
    error: null,
    supabase: {} as never,
  })
}

/* ------------------------------------------------------------------ */
/*  GET /api/admin/dlq                                                */
/* ------------------------------------------------------------------ */

describe('GET /api/admin/dlq', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await GET()
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

    const res = await GET()
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with entries list', async () => {
    const entries = [
      { id: 'dlq-1', stage: 'embed', error_message: 'timeout' },
      { id: 'dlq-2', stage: 'cluster', error_message: 'dimension mismatch' },
    ]

    adminAuth()
    mockListUnreplayed.mockResolvedValue(entries as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(entries)
  })

  it('returns 500 on service error', async () => {
    adminAuth()
    mockListUnreplayed.mockRejectedValue(new Error('DB connection lost'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('DB connection lost')
  })
})

/* ------------------------------------------------------------------ */
/*  POST /api/admin/dlq                                               */
/* ------------------------------------------------------------------ */

describe('POST /api/admin/dlq', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetAdmin.mockResolvedValue({
      user: null,
      isAdmin: false,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const res = await POST(makePostRequest({ action: 'replay', id: VALID_UUID }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockGetAdmin.mockResolvedValue({
      user: { id: 'user-1' } as never,
      isAdmin: false,
      error: null,
      supabase: {} as never,
    })

    const res = await POST(makePostRequest({ action: 'replay', id: VALID_UUID }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON body', async () => {
    adminAuth()

    const res = await POST(makeInvalidJsonRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid JSON body')
  })

  it('returns 400 for invalid action', async () => {
    adminAuth()

    const res = await POST(makePostRequest({ action: 'purge', id: VALID_UUID }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 400 for missing UUID', async () => {
    adminAuth()

    const res = await POST(makePostRequest({ action: 'replay' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid UUID format', async () => {
    adminAuth()

    const res = await POST(makePostRequest({ action: 'replay', id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with replayed: true on successful replay', async () => {
    adminAuth()
    mockReplay.mockResolvedValue(true as never)

    const res = await POST(makePostRequest({ action: 'replay', id: VALID_UUID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ id: VALID_UUID, replayed: true })
  })

  it('returns 404 when replay entry not found', async () => {
    adminAuth()
    mockReplay.mockResolvedValue(false as never)

    const res = await POST(makePostRequest({ action: 'replay', id: VALID_UUID }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('DLQ entry not found')
  })

  it('returns 200 with dismissed: true on successful dismiss', async () => {
    adminAuth()
    mockDismiss.mockResolvedValue(undefined as never)

    const res = await POST(makePostRequest({ action: 'dismiss', id: VALID_UUID }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ id: VALID_UUID, dismissed: true })
  })

  it('returns 409 for assembly version conflict error', async () => {
    adminAuth()
    mockReplay.mockRejectedValue(
      new Error('currently being assembled or its assembly_version moved')
    )

    const res = await POST(makePostRequest({ action: 'replay', id: VALID_UUID }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('assembly_version moved')
  })

  it('returns 500 for non-conflict service error', async () => {
    adminAuth()
    mockReplay.mockRejectedValue(new Error('unexpected failure'))

    const res = await POST(makePostRequest({ action: 'replay', id: VALID_UUID }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('unexpected failure')
  })
})
