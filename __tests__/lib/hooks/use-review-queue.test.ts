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
import { useReviewQueue } from '@/lib/hooks/use-review-queue'

const mockUseSWR = vi.mocked(useSWR)
const mockUseAuth = vi.mocked(useAuth)

const mockAuthReturn = {
  user: { id: 'admin-1' },
  session: null,
  isLoading: false,
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}

describe('useReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      ...mockAuthReturn,
      user: null,
    } as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    renderHook(() => useReviewQueue())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('fetches review queue for authenticated user', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [], meta: { total: 0 } },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useReviewQueue())

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/review'),
      expect.any(Function),
      expect.any(Object)
    )
    expect(result.current.stories).toEqual([])
  })

  it('includes status filter in URL', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [], meta: { total: 0, page: 1, limit: 20 } },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    renderHook(() => useReviewQueue({ status: 'pending' }))

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('status=pending'),
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns total count from meta', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [{ id: 'story-1' }], meta: { total: 42, page: 1, limit: 20 } },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useReviewQueue())
    expect(result.current.total).toBe(42)
  })

  it('supports page parameter', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    renderHook(() => useReviewQueue({ page: 3 }))

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('page=3'),
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('provides mutate for revalidation', () => {
    const mockMutate = vi.fn()
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      mutate: mockMutate,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useReviewQueue())
    expect(result.current.mutate).toBe(mockMutate)
  })
})
