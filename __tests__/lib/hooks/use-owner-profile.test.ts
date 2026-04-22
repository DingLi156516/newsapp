import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

import useSWR from 'swr'
import { useOwnerProfile } from '@/lib/hooks/use-owner-profile'

const mockUseSWR = vi.mocked(useSWR)

describe('useOwnerProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes null key when slug is empty', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    renderHook(() => useOwnerProfile(''))
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  it('passes slug-keyed endpoint when slug is set', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    renderHook(() => useOwnerProfile('fox-corporation'))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/owners/by-slug/fox-corporation',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns profile data when loaded', () => {
    const profile = {
      owner: { slug: 'fox-corporation', name: 'Fox Corporation' },
      sources: [],
      recentStories: [],
      topicBreakdown: [],
      storyCount: 0,
      blindspotCount: 0,
      biasDistribution: [],
    }
    mockUseSWR.mockReturnValue({
      data: { success: true, data: profile },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useOwnerProfile('fox-corporation'))
    expect(result.current.profile).toEqual(profile)
    expect(result.current.isError).toBe(false)
  })

  it('returns null profile when request errors with no data', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useOwnerProfile('fox-corporation'))
    expect(result.current.profile).toBeNull()
    expect(result.current.isError).toBe(true)
    expect(result.current.notFound).toBe(false)
  })

  it('flags notFound when fetcher throws a 404 error', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('API error 404: {"success":false,"error":"Owner not found"}'),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { result } = renderHook(() => useOwnerProfile('missing-owner'))
    expect(result.current.notFound).toBe(true)
    expect(result.current.isError).toBe(false)
    expect(result.current.profile).toBeNull()
  })
})
