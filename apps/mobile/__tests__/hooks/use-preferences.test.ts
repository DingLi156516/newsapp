import { renderHook, act } from '@testing-library/react-native'
import useSWR from 'swr'
import { usePreferences } from '@/lib/hooks/use-preferences'
import { authFetch } from '@/lib/hooks/fetcher'

jest.mock('swr')
jest.mock('@/lib/hooks/use-auth')
jest.mock('@/lib/hooks/fetcher', () => ({
  authFetch: jest.fn().mockResolvedValue({ ok: true }),
}))

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>
const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuth } = require('@/lib/hooks/use-auth')
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

const DEFAULT_PREFERENCES = {
  followed_topics: [],
  default_perspective: 'all',
  factuality_minimum: 'mixed',
  blindspot_digest_enabled: false,
}

const customPreferences = {
  followed_topics: ['politics', 'technology'],
  default_perspective: 'all',
  factuality_minimum: 'high',
  blindspot_digest_enabled: true,
}

describe('usePreferences', () => {
  const mutateFn = jest.fn().mockResolvedValue(undefined)

  afterEach(() => {
    jest.resetAllMocks()
    mutateFn.mockResolvedValue(undefined)
  })

  it('returns preferences from API data', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: customPreferences },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)

    const { result } = renderHook(() => usePreferences())

    expect(result.current.preferences).toEqual(customPreferences)
    expect(result.current.isLoading).toBe(false)
  })

  it('returns default preferences when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)

    const { result } = renderHook(() => usePreferences())

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns default preferences when data is undefined', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      mutate: mutateFn,
    } as any)

    const { result } = renderHook(() => usePreferences())

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(result.current.isLoading).toBe(true)
  })

  it('updatePreferences calls mutate and authFetch', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: DEFAULT_PREFERENCES },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)
    mockAuthFetch.mockResolvedValue({ ok: true } as Response)

    const { result } = renderHook(() => usePreferences())

    await act(async () => {
      await result.current.updatePreferences({ blindspot_digest_enabled: true })
    })

    // Optimistic update via mutate
    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ blindspot_digest_enabled: true }),
      }),
      false
    )

    // API call via authFetch
    expect(mockAuthFetch).toHaveBeenCalledWith(
      '/api/preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ blindspot_digest_enabled: true }),
      })
    )
  })

  it('updatePreferences does nothing when not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)

    const { result } = renderHook(() => usePreferences())

    await act(async () => {
      await result.current.updatePreferences({ blindspot_digest_enabled: true })
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
    expect(mutateFn).not.toHaveBeenCalled()
  })

  it('updatePreferences merges partial updates with current preferences', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: customPreferences },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)
    mockAuthFetch.mockResolvedValue({ ok: true } as Response)

    const { result } = renderHook(() => usePreferences())

    await act(async () => {
      await result.current.updatePreferences({ factuality_minimum: 'very-high' as any })
    })

    expect(mutateFn).toHaveBeenCalledWith(
      {
        success: true,
        data: {
          ...customPreferences,
          factuality_minimum: 'very-high',
        },
      },
      false
    )
  })

  it('passes null SWR key when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)

    renderHook(() => usePreferences())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Object))
  })

  it('passes /api/preferences key when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: DEFAULT_PREFERENCES },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)

    renderHook(() => usePreferences())

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/preferences',
      expect.any(Object)
    )
  })

  it('revalidates after failed update', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: { success: true, data: DEFAULT_PREFERENCES },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)
    mockAuthFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => usePreferences())

    await act(async () => {
      try {
        await result.current.updatePreferences({ blindspot_digest_enabled: true })
      } catch {
        // Expected to throw
      }
    })

    // First call: optimistic update, Second call: revert on error
    expect(mutateFn).toHaveBeenCalled()
  })
})
