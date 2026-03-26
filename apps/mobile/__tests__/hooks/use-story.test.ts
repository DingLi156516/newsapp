import { renderHook } from '@testing-library/react-native'
import useSWR from 'swr'
import { useStory } from '@/lib/hooks/use-story'

jest.mock('swr')
jest.mock('@/lib/offline/cache-manager', () => ({
  getCachedStory: jest.fn().mockResolvedValue(null),
}))

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

const mockStory = {
  id: 'story-1',
  headline: 'Test Story',
  topic: 'politics',
  sourceCount: 5,
  isBlindspot: false,
  factuality: 'high',
  sources: [],
  spectrumSegments: [],
}

describe('useStory', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns story from API data', () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, data: mockStory },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useStory('story-1'))

    expect(result.current.story).toEqual(mockStory)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('passes correct SWR key for a given id', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useStory('abc-123'))

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories/abc-123',
      expect.any(Object)
    )
  })

  it('passes null SWR key when id is empty string', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useStory(''))

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Object))
  })

  it('returns isLoading true while fetching', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useStory('story-1'))

    expect(result.current.isLoading).toBe(true)
  })

  it('exposes isError flag from SWR', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Not found'),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    // getCachedStory is called in useEffect — mock it at module level
    const cacheManager = require('@/lib/offline/cache-manager')
    cacheManager.getCachedStory.mockResolvedValue(null)

    const { result } = renderHook(() => useStory('story-1'))

    expect(result.current.isError).toBe(true)
  })

  it('returns null when no API data or cache', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useStory('a1'))

    // No sample data fallback — returns null when no API data or cache
    expect(result.current.story).toBeNull()
  })

  it('returns null story for unknown id with no data', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useStory('nonexistent-id'))

    expect(result.current.story).toBeNull()
  })
})
