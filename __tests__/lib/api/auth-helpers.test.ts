/**
 * Tests for lib/api/auth-helpers.ts — Server-side auth utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockSet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: mockSet,
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

// Import after mocks are set up
const { getAuthenticatedUser } = await import('@/lib/api/auth-helpers')

describe('getAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when authenticated', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const result = await getAuthenticatedUser()

    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeNull()
    expect(result.supabase).toBeDefined()
  })

  it('returns null user when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await getAuthenticatedUser()

    expect(result.user).toBeNull()
    expect(result.error).toBeNull()
  })

  it('returns error message when auth fails', async () => {
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
})
