/**
 * Tests for lib/hooks/use-suggestions.ts
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
import { useSuggestions } from '@/lib/hooks/use-suggestions'

const mockUseSWR = vi.mocked(useSWR)
const mockUseAuth = vi.mocked(useAuth)

const mockAuthReturn = {
  user: null,
  session: null,
  isLoading: false,
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}

describe('useSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when not authenticated', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn)
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useSuggestions())
    expect(result.current.suggestions).toEqual([])
  })

  it('passes null key to SWR when not authenticated', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn)
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    renderHook(() => useSuggestions())
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('returns suggestions when authenticated', () => {
    const mockSuggestions = [
      { id: 'story-1', headline: 'Test Story' },
    ]

    mockUseAuth.mockReturnValue({
      ...mockAuthReturn,
      user: { id: 'user-1' } as never,
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: mockSuggestions },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useSuggestions())
    expect(result.current.suggestions).toEqual(mockSuggestions)
    expect(result.current.isError).toBe(false)
  })

  it('passes /api/dashboard/suggestions key when authenticated', () => {
    mockUseAuth.mockReturnValue({
      ...mockAuthReturn,
      user: { id: 'user-1' } as never,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    renderHook(() => useSuggestions())
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/dashboard/suggestions',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns isLoading state', () => {
    mockUseAuth.mockReturnValue({
      ...mockAuthReturn,
      user: { id: 'user-1' } as never,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useSuggestions())
    expect(result.current.isLoading).toBe(true)
  })

  it('returns isError when SWR has error', () => {
    mockUseAuth.mockReturnValue({
      ...mockAuthReturn,
      user: { id: 'user-1' } as never,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('fetch failed'),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useSuggestions())
    expect(result.current.isError).toBe(true)
  })
})
