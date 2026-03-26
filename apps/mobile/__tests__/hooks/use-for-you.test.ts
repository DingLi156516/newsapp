import { renderHook } from '@testing-library/react-native'
import useSWR from 'swr'
import { useForYou } from '@/lib/hooks/use-for-you'

jest.mock('swr')
jest.mock('@/lib/hooks/use-auth')

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuth } = require('@/lib/hooks/use-auth')
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

const mockStories = [
  { id: 'fy-1', headline: 'For You Story 1', topic: 'politics', sourceCount: 4 },
  { id: 'fy-2', headline: 'For You Story 2', topic: 'technology', sourceCount: 7 },
]

describe('useForYou', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns stories when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: {
        success: true,
        data: mockStories,
        meta: { total: 2, page: 1, limit: 20 },
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useForYou())

    expect(result.current.stories).toEqual(mockStories)
    expect(result.current.total).toBe(2)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('returns empty stories when not authenticated', () => {
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
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useForYou())

    expect(result.current.stories).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.isAuthenticated).toBe(false)
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
      mutate: jest.fn(),
    } as any)

    renderHook(() => useForYou())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Object))
  })

  it('passes correct SWR key with default page when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useForYou())

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories/for-you?page=1',
      expect.any(Object)
    )
  })

  it('passes correct SWR key with custom page', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useForYou(3))

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories/for-you?page=3',
      expect.any(Object)
    )
  })

  it('sets isError when SWR returns an error', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
    })
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Server error'),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useForYou())

    expect(result.current.isError).toBe(true)
    expect(result.current.stories).toEqual([])
  })

  it('isLoading reflects SWR loading state', () => {
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
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useForYou())

    expect(result.current.isLoading).toBe(true)
  })

  it('exposes mutate function', () => {
    const mutateFn = jest.fn()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
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

    const { result } = renderHook(() => useForYou())

    expect(result.current.mutate).toBe(mutateFn)
  })
})
