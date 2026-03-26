import { renderHook, act, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useOnboarding } from '@/lib/hooks/use-onboarding'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

describe('useOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null initially while loading', () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    const { result } = renderHook(() => useOnboarding())
    // Initially null (loading)
    expect(result.current.hasSeenOnboarding).toBeNull()
  })

  it('returns false when not seen', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    const { result } = renderHook(() => useOnboarding())

    await waitFor(() => {
      expect(result.current.hasSeenOnboarding).toBe(false)
    })
  })

  it('returns true after completing', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
    const { result } = renderHook(() => useOnboarding())

    await waitFor(() => {
      expect(result.current.hasSeenOnboarding).toBe(false)
    })

    await act(async () => {
      await result.current.completeOnboarding()
    })

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('hasSeenOnboarding', 'true')
    expect(result.current.hasSeenOnboarding).toBe(true)
  })
})
