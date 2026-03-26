/**
 * Tests for lib/api/auth-helpers.ts — Server-side auth utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockSet = vi.fn()
const mockHeadersGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: mockSet,
  }),
  headers: vi.fn().mockResolvedValue({
    get: mockHeadersGet,
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } }),
    },
  })),
}))

// Import after mocks are set up
const { getAuthenticatedUser } = await import('@/lib/api/auth-helpers')

describe('getAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeadersGet.mockReturnValue(null) // No Bearer token by default
  })

  it('returns user when cookie-authenticated', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const result = await getAuthenticatedUser()

    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeNull()
    expect(result.supabase).toBeDefined()
  })

  it('returns null user when not authenticated (no cookie, no Bearer)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await getAuthenticatedUser()

    expect(result.user).toBeNull()
    expect(result.error).toBeNull()
  })

  it('returns error message when cookie auth fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    })

    const result = await getAuthenticatedUser()

    expect(result.user).toBeNull()
    expect(result.error).toBe('JWT expired')
  })

  it('provides supabase client in result', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await getAuthenticatedUser()

    expect(result.supabase).toBeDefined()
    expect(result.supabase.auth).toBeDefined()
  })

  it('falls back to Bearer token when cookie auth returns no user', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockTokenUser = { id: '456', email: 'mobile@example.com' }
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockTokenUser }, error: null }),
      },
    })
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    mockHeadersGet.mockReturnValue('Bearer valid-token-123')

    const result = await getAuthenticatedUser()

    expect(result.user).toEqual(mockTokenUser)
    expect(result.error).toBeNull()
  })
})
