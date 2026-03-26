import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

vi.mock('swr/mutation', () => ({
  default: vi.fn(),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/hooks/fetcher', () => ({
  fetcher: vi.fn(),
}))

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { useAuth } from '@/lib/hooks/use-auth'
import { usePipelineRuns, useSourceHealth, usePipelineTrigger } from '@/lib/hooks/use-pipeline'

const mockUseSWR = vi.mocked(useSWR)
const mockUseSWRMutation = vi.mocked(useSWRMutation)
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

describe('usePipelineRuns', () => {
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

    const { result } = renderHook(() => usePipelineRuns())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
    expect(result.current.runs).toEqual([])
  })

  it('fetches pipeline runs for authenticated user', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [{ id: 'run-1' }] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => usePipelineRuns())

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/pipeline'),
      expect.any(Function),
      expect.any(Object)
    )
    expect(result.current.runs).toEqual([{ id: 'run-1' }])
  })

  it('includes limit parameter in URL', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    renderHook(() => usePipelineRuns(50))

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('limit=50'),
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns empty array when data is undefined', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => usePipelineRuns())

    expect(result.current.runs).toEqual([])
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

    const { result } = renderHook(() => usePipelineRuns())

    expect(result.current.mutate).toBe(mockMutate)
  })
})

describe('useSourceHealth', () => {
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

    const { result } = renderHook(() => useSourceHealth())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
    expect(result.current.sources).toEqual([])
  })

  it('fetches source health for authenticated user', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [{ id: 'src-1', name: 'Reuters' }] },
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useSourceHealth())

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/admin/pipeline/sources',
      expect.any(Function),
      expect.any(Object)
    )
    expect(result.current.sources).toEqual([{ id: 'src-1', name: 'Reuters' }])
  })

  it('returns empty array when data is undefined', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      mutate: vi.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as never)

    const { result } = renderHook(() => useSourceHealth())

    expect(result.current.sources).toEqual([])
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

    const { result } = renderHook(() => useSourceHealth())

    expect(result.current.mutate).toBe(mockMutate)
  })
})

describe('usePipelineTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls useSWRMutation with correct URL', () => {
    const mockTrigger = vi.fn()
    mockUseSWRMutation.mockReturnValue({
      trigger: mockTrigger,
      isMutating: false,
      error: undefined,
      data: undefined,
      reset: vi.fn(),
    } as never)

    renderHook(() => usePipelineTrigger())

    expect(mockUseSWRMutation).toHaveBeenCalledWith(
      '/api/admin/pipeline/trigger',
      expect.any(Function)
    )
  })

  it('returns trigger function', () => {
    const mockTrigger = vi.fn()
    mockUseSWRMutation.mockReturnValue({
      trigger: mockTrigger,
      isMutating: false,
      error: undefined,
      data: undefined,
      reset: vi.fn(),
    } as never)

    const { result } = renderHook(() => usePipelineTrigger())

    expect(result.current.trigger).toBe(mockTrigger)
  })

  it('returns isTriggering from isMutating', () => {
    mockUseSWRMutation.mockReturnValue({
      trigger: vi.fn(),
      isMutating: true,
      error: undefined,
      data: undefined,
      reset: vi.fn(),
    } as never)

    const { result } = renderHook(() => usePipelineTrigger())

    expect(result.current.isTriggering).toBe(true)
  })

  it('returns error message from Error instance', () => {
    mockUseSWRMutation.mockReturnValue({
      trigger: vi.fn(),
      isMutating: false,
      error: new Error('Trigger failed'),
      data: undefined,
      reset: vi.fn(),
    } as never)

    const { result } = renderHook(() => usePipelineTrigger())

    expect(result.current.error).toBe('Trigger failed')
  })

  it('returns null error when no error', () => {
    mockUseSWRMutation.mockReturnValue({
      trigger: vi.fn(),
      isMutating: false,
      error: undefined,
      data: undefined,
      reset: vi.fn(),
    } as never)

    const { result } = renderHook(() => usePipelineTrigger())

    expect(result.current.error).toBeNull()
  })
})
