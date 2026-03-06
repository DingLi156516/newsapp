import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock SWR
vi.mock('swr', () => ({
  default: vi.fn(),
}))

// Mock useAuth
vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'

const mockUseSWR = vi.mocked(useSWR)
const mockUseAuth = vi.mocked(useAuth)

describe('useBookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('uses local state when user is not authenticated', () => {
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
      data: { success: true, data: [] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as any)

    const { result } = renderHook(() => useBookmarks())

    expect(result.current.count).toBe(0)
    expect(result.current.isBookmarked('story-1')).toBe(false)
  })

  it('toggles local bookmark when not authenticated', async () => {
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
      data: { success: true, data: [] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as any)

    const { result } = renderHook(() => useBookmarks())

    await act(async () => {
      await result.current.toggle('story-1')
    })

    expect(result.current.isBookmarked('story-1')).toBe(true)
    expect(result.current.count).toBe(1)
  })

  it('uses server bookmarks when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' } as any,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: ['story-1', 'story-2'] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as any)

    const { result } = renderHook(() => useBookmarks())

    expect(result.current.count).toBe(2)
    expect(result.current.isBookmarked('story-1')).toBe(true)
    expect(result.current.isBookmarked('story-3')).toBe(false)
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
      data: { success: true, data: [] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as any)

    renderHook(() => useBookmarks())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('passes /api/bookmarks key to SWR when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' } as any,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as any)

    renderHook(() => useBookmarks())

    expect(mockUseSWR).toHaveBeenCalledWith('/api/bookmarks', expect.any(Function), expect.any(Object))
  })
})
