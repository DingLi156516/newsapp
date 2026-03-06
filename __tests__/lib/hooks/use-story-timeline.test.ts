import { renderHook, waitFor } from '@testing-library/react'
import { useStoryTimeline } from '@/lib/hooks/use-story-timeline'
import { sampleTimelines } from '@/lib/sample-timeline'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

import useSWR from 'swr'

describe('useStoryTimeline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns loading state initially', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    })

    const { result } = renderHook(() => useStoryTimeline('test-id'))

    expect(result.current.isLoading).toBe(true)
  })

  it('returns timeline data from API', async () => {
    const mockTimeline = {
      storyId: 'test-id',
      events: [],
      totalArticles: 5,
      timeSpanHours: 24,
    }

    vi.mocked(useSWR).mockReturnValue({
      data: { success: true, data: mockTimeline },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })

    const { result } = renderHook(() => useStoryTimeline('test-id'))

    await waitFor(() => {
      expect(result.current.timeline).toEqual(mockTimeline)
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('falls back to sample timeline when API has no data', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })

    const { result } = renderHook(() => useStoryTimeline('a1'))

    expect(result.current.timeline).toEqual(sampleTimelines['a1'])
  })

  it('returns null timeline for unknown ID without API data', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })

    const { result } = renderHook(() => useStoryTimeline('unknown-id'))

    expect(result.current.timeline).toBeNull()
  })

  it('returns error state on failure', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: new Error('Network error'),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })

    const { result } = renderHook(() => useStoryTimeline('test-id'))

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('passes correct SWR key', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })

    renderHook(() => useStoryTimeline('my-story-id'))

    expect(useSWR).toHaveBeenCalledWith(
      '/api/stories/my-story-id/timeline',
      expect.any(Function),
      expect.objectContaining({ dedupingInterval: 30000 })
    )
  })
})
