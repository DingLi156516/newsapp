import { renderHook } from '@testing-library/react-native'
import useSWR from 'swr'
import { useHotStories } from '@/lib/hooks/use-hot-stories'

jest.mock('swr')
jest.mock('@/lib/hooks/use-auth')

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuth } = require('@/lib/hooks/use-auth')
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('useHotStories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes a null key to SWR when unauthenticated (skip fetch)', () => {
    mockUseAuth.mockReturnValue({ user: null } as never)
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false } as never)
    renderHook(() => useHotStories())
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.anything())
  })

  it('uses the hot-stories endpoint when authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } } as never)
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true } as never)
    renderHook(() => useHotStories())
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/dashboard/hot-stories',
      expect.objectContaining({ revalidateOnFocus: false })
    )
  })

  it('returns hot stories when SWR resolves with data', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } } as never)
    const stories = [{ id: 'a', uniqueViewers6h: 10 }] as never
    mockUseSWR.mockReturnValue({
      data: { success: true, data: stories },
      error: undefined,
      isLoading: false,
    } as never)
    const { result } = renderHook(() => useHotStories())
    expect(result.current.hotStories).toEqual(stories)
  })

  it('flags isError when SWR returns an error', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } } as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
    } as never)
    const { result } = renderHook(() => useHotStories())
    expect(result.current.isError).toBe(true)
  })
})
