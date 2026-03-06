import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { getAdminUser } from '@/lib/api/admin-helpers'

const mockGetAuth = vi.mocked(getAuthenticatedUser)

function createMockQueryBuilder(data: unknown = null, error: null | { message: string } = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      resolve({ data, error })
      return Promise.resolve({ data, error })
    }),
  }
  Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' })
  return builder
}

describe('getAdminUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when user is not authenticated', async () => {
    mockGetAuth.mockResolvedValue({
      user: null,
      error: 'Unauthorized',
      supabase: {} as never,
    })

    const result = await getAdminUser()

    expect(result.user).toBeNull()
    expect(result.isAdmin).toBe(false)
    expect(result.error).toBe('Unauthorized')
  })

  it('returns isAdmin true when user is in admin_users table', async () => {
    const builder = createMockQueryBuilder({ id: 'admin-1', user_id: 'user-1' })
    const mockSupabase = { from: vi.fn().mockReturnValue(builder) }
    const mockUser = { id: 'user-1', email: 'admin@test.com' }

    mockGetAuth.mockResolvedValue({
      user: mockUser as never,
      error: null,
      supabase: mockSupabase as never,
    })

    const result = await getAdminUser()

    expect(result.user).toEqual(mockUser)
    expect(result.isAdmin).toBe(true)
    expect(result.error).toBeNull()
    expect(mockSupabase.from).toHaveBeenCalledWith('admin_users')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('returns isAdmin false when user is not in admin_users table', async () => {
    const builder = createMockQueryBuilder(null, { message: 'Not found' })
    const mockSupabase = { from: vi.fn().mockReturnValue(builder) }
    const mockUser = { id: 'user-2', email: 'regular@test.com' }

    mockGetAuth.mockResolvedValue({
      user: mockUser as never,
      error: null,
      supabase: mockSupabase as never,
    })

    const result = await getAdminUser()

    expect(result.user).toEqual(mockUser)
    expect(result.isAdmin).toBe(false)
    expect(result.error).toBeNull()
  })

  it('returns supabase client in result', async () => {
    const builder = createMockQueryBuilder({ id: 'admin-1', user_id: 'user-1' })
    const mockSupabase = { from: vi.fn().mockReturnValue(builder) }
    const mockUser = { id: 'user-1' }

    mockGetAuth.mockResolvedValue({
      user: mockUser as never,
      error: null,
      supabase: mockSupabase as never,
    })

    const result = await getAdminUser()
    expect(result.supabase).toBe(mockSupabase)
  })
})
