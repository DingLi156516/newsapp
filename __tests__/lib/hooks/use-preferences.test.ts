import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { usePreferences } from '@/lib/hooks/use-preferences'

const mockUseSWR = vi.mocked(useSWR)
const mockUseAuth = vi.mocked(useAuth)

describe('usePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default preferences when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: {
        followed_topics: [],
        default_perspective: 'all',
        factuality_minimum: 'mixed',
      }},
      mutate: vi.fn(),
      isLoading: false,
      error: undefined,
      isValidating: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { result } = renderHook(() => usePreferences())

    expect(result.current.preferences.default_perspective).toBe('all')
    expect(result.current.preferences.followed_topics).toEqual([])
  })

  it('passes null key to SWR when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      mutate: vi.fn(),
      isLoading: false,
      error: undefined,
      isValidating: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderHook(() => usePreferences())
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('passes /api/preferences key to SWR when authenticated', () => {
    mockUseAuth.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: { id: 'user-1' } as any,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: {
        followed_topics: ['politics'],
        default_perspective: 'left',
        factuality_minimum: 'high',
      }},
      mutate: vi.fn(),
      isLoading: false,
      error: undefined,
      isValidating: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { result } = renderHook(() => usePreferences())
    expect(mockUseSWR).toHaveBeenCalledWith('/api/preferences', expect.any(Function), expect.any(Object))
    expect(result.current.preferences.followed_topics).toEqual(['politics'])
  })
})
