import { renderHook } from '@testing-library/react-native'
import useSWR from 'swr'
import { useSource } from '@/lib/hooks/use-source'

jest.mock('swr')
const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

const mockProfile = {
  source: {
    id: 's1',
    slug: 'reuters',
    name: 'Reuters',
    bias: 'center',
    factuality: 'very-high',
    ownership: 'independent',
    isActive: true,
  },
  recentStories: [],
  topicBreakdown: [],
  blindspotCount: 0,
}

describe('useSource', () => {
  afterEach(() => jest.resetAllMocks())

  it('returns profile from API data', () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, data: mockProfile },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useSource('reuters'))

    expect(result.current.profile).toEqual(mockProfile)
    expect(result.current.isError).toBe(false)
  })

  it('constructs URL from slug', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true, isValidating: true, mutate: jest.fn() } as any)
    renderHook(() => useSource('bbc-news'))

    expect(mockUseSWR).toHaveBeenCalledWith('/api/sources/bbc-news', expect.any(Object))
  })

  it('encodes slugs that contain special characters', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true, isValidating: true, mutate: jest.fn() } as any)
    renderHook(() => useSource('news with space'))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toBe('/api/sources/news%20with%20space')
  })

  it('skips fetch when slug is null', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, isValidating: false, mutate: jest.fn() } as any)
    renderHook(() => useSource(null))

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Object))
  })

  it('marks isError true when API returns success=false', () => {
    mockUseSWR.mockReturnValue({
      data: { success: false, error: 'Source not found' },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useSource('missing'))
    expect(result.current.profile).toBeNull()
    expect(result.current.isError).toBe(true)
  })

  it('marks isError true when SWR errors', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('network'),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useSource('reuters'))
    expect(result.current.isError).toBe(true)
  })
})
