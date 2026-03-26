import { renderHook, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useFeedConfig } from '@/lib/hooks/use-feed-config'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}))

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>

describe('useFeedConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
  })

  it('returns defaults when AsyncStorage is empty', async () => {
    const { result } = renderHook(() => useFeedConfig())

    await act(async () => {})

    expect(result.current.visibleFeeds).toEqual(
      expect.arrayContaining(['for-you', 'trending', 'latest'])
    )
    expect(result.current.feedSort).toBe('most-covered')
    expect(result.current.isLoaded).toBe(true)
  })

  it('loads saved config from AsyncStorage', async () => {
    mockGetItem.mockImplementation(async (key) => {
      if (key === '@axiom/visible_feeds') return JSON.stringify(['trending', 'politics'])
      if (key === '@axiom/feed_sort') return 'most-recent'
      return null
    })

    const { result } = renderHook(() => useFeedConfig())

    await act(async () => {})

    expect(result.current.visibleFeeds).toEqual(['trending', 'politics'])
    expect(result.current.feedSort).toBe('most-recent')
    expect(result.current.isLoaded).toBe(true)
  })

  it('updateConfig persists visibleFeeds to AsyncStorage', async () => {
    const { result } = renderHook(() => useFeedConfig())

    await act(async () => {})
    await act(async () => {
      await result.current.updateConfig({ visibleFeeds: ['trending', 'technology'] })
    })

    expect(mockSetItem).toHaveBeenCalledWith(
      '@axiom/visible_feeds',
      JSON.stringify(['trending', 'technology'])
    )
    expect(result.current.visibleFeeds).toEqual(['trending', 'technology'])
  })

  it('updateConfig persists feedSort to AsyncStorage', async () => {
    const { result } = renderHook(() => useFeedConfig())

    await act(async () => {})
    await act(async () => {
      await result.current.updateConfig({ feedSort: 'most-recent' })
    })

    expect(mockSetItem).toHaveBeenCalledWith('@axiom/feed_sort', 'most-recent')
    expect(result.current.feedSort).toBe('most-recent')
  })

  it('handles AsyncStorage errors gracefully', async () => {
    mockGetItem.mockRejectedValue(new Error('Storage error'))

    const { result } = renderHook(() => useFeedConfig())

    await act(async () => {})

    expect(result.current.feedSort).toBe('most-covered')
    expect(result.current.isLoaded).toBe(true)
  })
})
