/**
 * Tests for lib/hooks/use-bias-profile.ts
 */

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
import { useBiasProfile } from '@/lib/hooks/use-bias-profile'

const mockUseSWR = vi.mocked(useSWR)
const mockUseAuth = vi.mocked(useAuth)

describe('useBiasProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null profile when not authenticated', () => {
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
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useBiasProfile())
    expect(result.current.profile).toBeNull()
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
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    renderHook(() => useBiasProfile())
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('returns profile data when authenticated', () => {
    const mockProfile = {
      userDistribution: [{ bias: 'left', percentage: 60 }],
      overallDistribution: [{ bias: 'left', percentage: 40 }],
      blindspots: ['right'],
      totalStoriesRead: 10,
      dominantBias: 'left',
    }

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' } as never,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: mockProfile },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useBiasProfile())
    expect(result.current.profile).toEqual(mockProfile)
    expect(result.current.isError).toBe(false)
  })

  it('passes correct key when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' } as never,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    renderHook(() => useBiasProfile())
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/dashboard/bias-profile',
      expect.any(Function),
      expect.any(Object)
    )
  })
})
