/**
 * Tests for app/api/events/story/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const STORY_ID = '550e8400-e29b-41d4-a716-446655440000'

const cookieStore = new Map<string, { value: string }>()
const headerStore = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    getAll: () => Array.from(cookieStore.entries()).map(([name, v]) => ({ name, value: v.value })),
  }),
  headers: async () => ({
    get: (name: string) => headerStore.get(name.toLowerCase()) ?? null,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ user: null, error: null, supabase: {} }),
}))

vi.mock('@/lib/api/engagement-queries', () => ({
  insertStoryViewEvent: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/events/story/route'
import { insertStoryViewEvent } from '@/lib/api/engagement-queries'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'

const mockInsert = vi.mocked(insertStoryViewEvent)
const mockAuth = vi.mocked(getAuthenticatedUser)

function makeRequest(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/events/story'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieStore.clear()
  headerStore.clear()
  cookieStore.set('axiom_session', { value: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })
  mockAuth.mockResolvedValue({ user: null, error: null, supabase: {} as never })
})

describe('POST /api/events/story', () => {
  it('returns 204 on success and inserts the event', async () => {
    const res = await POST(
      makeRequest({ storyId: STORY_ID, action: 'view', client: 'web' })
    )
    expect(res.status).toBe(204)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert.mock.calls[0][1]).toMatchObject({
      story_id: STORY_ID,
      session_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      action: 'view',
      client: 'web',
      user_id: null,
    })
  })

  it('returns 400 on invalid body', async () => {
    const res = await POST(
      makeRequest({ storyId: 'not-a-uuid', action: 'view', client: 'web' })
    )
    expect(res.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 400 when JSON body is malformed', async () => {
    const req = new NextRequest(new URL('http://localhost/api/events/story'), {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('drops with 204 when DNT=1', async () => {
    headerStore.set('dnt', '1')
    const res = await POST(
      makeRequest({ storyId: STORY_ID, action: 'view', client: 'web' })
    )
    expect(res.status).toBe(204)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('drops with 204 when no session id is present', async () => {
    cookieStore.clear()
    const res = await POST(
      makeRequest({ storyId: STORY_ID, action: 'view', client: 'web' })
    )
    expect(res.status).toBe(204)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('drops with 204 when the session id is not a UUID', async () => {
    cookieStore.set('axiom_session', { value: 'not-a-uuid' })
    const res = await POST(
      makeRequest({ storyId: STORY_ID, action: 'view', client: 'web' })
    )
    expect(res.status).toBe(204)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('reads session id from x-session-id header (mobile)', async () => {
    cookieStore.clear()
    headerStore.set('x-session-id', '11111111-2222-4333-8444-555555555555')
    const res = await POST(
      makeRequest({ storyId: STORY_ID, action: 'view', client: 'mobile' })
    )
    expect(res.status).toBe(204)
    expect(mockInsert.mock.calls[0][1].session_id).toBe('11111111-2222-4333-8444-555555555555')
  })

  it('attaches user_id when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-99' } as never,
      error: null,
      supabase: {} as never,
    })
    await POST(makeRequest({ storyId: STORY_ID, action: 'view', client: 'web' }))
    expect(mockInsert.mock.calls[0][1].user_id).toBe('user-99')
  })

  it('returns 500 if insert throws', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB down'))
    const res = await POST(
      makeRequest({ storyId: STORY_ID, action: 'view', client: 'web' })
    )
    expect(res.status).toBe(500)
  })

  it('sets Cache-Control: no-store on success', async () => {
    const res = await POST(
      makeRequest({ storyId: STORY_ID, action: 'view', client: 'web' })
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
