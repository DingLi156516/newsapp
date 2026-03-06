/**
 * Tests for lib/hooks/use-for-you.ts
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
import { useForYou } from '@/lib/hooks/use-for-you'

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

describe('useForYou', () => {
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

    const { result } = renderHook(() => useForYou())
    expect(result.current.stories).toEqual([])
    expect(result.current.isAuthenticated).toBe(false)
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

    renderHook(() => useForYou())
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('passes /api/stories/for-you key when authenticated', () => {
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

    renderHook(() => useForYou())
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories/for-you',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns stories when authenticated', () => {
    const mockStories = [
      { id: 'story-1', headline: 'Test Story' },
    ]

    mockUseAuth.mockReturnValue({
      ...mockAuthReturn,
      user: { id: 'user-1' } as never,
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: mockStories, meta: { total: 1, page: 1, limit: 20 } },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useForYou())
    expect(result.current.stories).toEqual(mockStories)
    expect(result.current.total).toBe(1)
    expect(result.current.isAuthenticated).toBe(true)
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

    const { result } = renderHook(() => useForYou())
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

    const { result } = renderHook(() => useForYou())
    expect(result.current.isError).toBe(true)
  })
})
