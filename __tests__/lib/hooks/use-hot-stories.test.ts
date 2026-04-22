import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { useHotStories } from '@/lib/hooks/use-hot-stories'

const mockSWR = vi.mocked(useSWR)
const mockAuth = vi.mocked(useAuth)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHotStories', () => {
  it('does not fetch when unauthenticated', () => {
    mockAuth.mockReturnValue({ user: null } as never)
    mockSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false } as never)
    renderHook(() => useHotStories())
    expect(mockSWR).toHaveBeenCalledWith(null, expect.anything(), expect.anything())
  })

  it('fetches /api/dashboard/hot-stories when authenticated', () => {
    mockAuth.mockReturnValue({ user: { id: 'u1' } } as never)
    mockSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true } as never)
    renderHook(() => useHotStories())
    expect(mockSWR).toHaveBeenCalledWith(
      '/api/dashboard/hot-stories',
      expect.anything(),
      expect.anything()
    )
  })

  it('returns hotStories from data.data', () => {
    mockAuth.mockReturnValue({ user: { id: 'u1' } } as never)
    const stories = [{ id: 'a', uniqueViewers6h: 5 }] as never
    mockSWR.mockReturnValue({
      data: { success: true, data: stories },
      error: undefined,
      isLoading: false,
    } as never)
    const { result } = renderHook(() => useHotStories())
    expect(result.current.hotStories).toEqual(stories)
    expect(result.current.isError).toBe(false)
  })

  it('flags isError when SWR returns an error', () => {
    mockAuth.mockReturnValue({ user: { id: 'u1' } } as never)
    mockSWR.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
    } as never)
    const { result } = renderHook(() => useHotStories())
    expect(result.current.isError).toBe(true)
  })
})
