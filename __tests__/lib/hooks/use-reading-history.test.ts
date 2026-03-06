/**
 * Tests for lib/hooks/use-reading-history.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'

const mockUseSWR = vi.mocked(useSWR)
const mockUseAuth = vi.mocked(useAuth)

function mockAuthState(authenticated: boolean) {
  mockUseAuth.mockReturnValue({
    user: authenticated ? ({ id: 'user-1' } as never) : null,
    session: null,
    isLoading: false,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })
}

describe('useReadingHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('returns false for isRead when not authenticated', () => {
    mockAuthState(false)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useReadingHistory())

    expect(result.current.isRead('story-1')).toBe(false)
    expect(result.current.readCount).toBe(0)
  })

  it('passes null key to SWR when not authenticated', () => {
    mockAuthState(false)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    renderHook(() => useReadingHistory())
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('returns read state from server when authenticated', () => {
    mockAuthState(true)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: ['story-1', 'story-2'] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useReadingHistory())

    expect(result.current.isRead('story-1')).toBe(true)
    expect(result.current.isRead('story-3')).toBe(false)
    expect(result.current.readCount).toBe(2)
  })

  it('markAsRead is a no-op when not authenticated', async () => {
    mockAuthState(false)
    const mockMutate = vi.fn()
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [] },
      mutate: mockMutate,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useReadingHistory())

    await act(async () => {
      await result.current.markAsRead('story-1')
    })

    expect(fetch).not.toHaveBeenCalled()
  })

  it('markAsRead calls API when authenticated', async () => {
    mockAuthState(true)
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [] },
      mutate: mockMutate,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    vi.mocked(global.fetch).mockResolvedValue(new Response('{}'))

    const { result } = renderHook(() => useReadingHistory())

    await act(async () => {
      await result.current.markAsRead('story-1')
    })

    expect(fetch).toHaveBeenCalledWith('/api/reading-history/story-1', { method: 'POST' })
  })

  it('markAsRead skips if already read', async () => {
    mockAuthState(true)
    const mockMutate = vi.fn()
    mockUseSWR.mockReturnValue({
      data: { success: true, data: ['story-1'] },
      mutate: mockMutate,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useReadingHistory())

    await act(async () => {
      await result.current.markAsRead('story-1')
    })

    expect(fetch).not.toHaveBeenCalled()
  })

  it('markAsUnread calls API when authenticated', async () => {
    mockAuthState(true)
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: ['story-1'] },
      mutate: mockMutate,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    vi.mocked(global.fetch).mockResolvedValue(new Response('{}'))

    const { result } = renderHook(() => useReadingHistory())

    await act(async () => {
      await result.current.markAsUnread('story-1')
    })

    expect(fetch).toHaveBeenCalledWith('/api/reading-history/story-1', { method: 'DELETE' })
  })
})
