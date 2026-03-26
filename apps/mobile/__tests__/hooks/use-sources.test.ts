import { renderHook } from '@testing-library/react-native'
import useSWR from 'swr'
import { useSources } from '@/lib/hooks/use-sources'

jest.mock('swr')
const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

const mockSources = [
  { id: 's1', name: 'The Guardian', bias: 'left', factuality: 'high', ownership: 'non-profit', url: 'theguardian.com' },
  { id: 's2', name: 'BBC News', bias: 'center', factuality: 'very-high', ownership: 'state-funded', url: 'bbc.com' },
]

describe('useSources', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns sources from API data', () => {
    mockUseSWR.mockReturnValue({
      data: {
        success: true,
        data: mockSources,
        meta: { total: 2, page: 1, limit: 50 },
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useSources())

    expect(result.current.sources).toEqual(mockSources)
    expect(result.current.total).toBe(2)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('returns empty array when loading', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useSources())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.sources).toEqual([])
  })

  it('sets isError when SWR returns an error', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Failed to fetch'),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useSources())

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('constructs correct SWR key with no params', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources())

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/sources',
      expect.any(Object)
    )
  })

  it('constructs correct SWR key with bias filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ bias: 'left' }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('bias=left')
  })

  it('constructs correct SWR key with factuality filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ factuality: 'high' }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('factuality=high')
  })

  it('constructs correct SWR key with ownership filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ ownership: 'corporate' }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('ownership=corporate')
  })

  it('constructs correct SWR key with region filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ region: 'us' as any }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('region=us')
  })

  it('constructs correct SWR key with search filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ search: 'guardian' }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('search=guardian')
  })

  it('constructs correct SWR key with pagination', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ page: 2, limit: 25 }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('page=2')
    expect(calledKey).toContain('limit=25')
  })

  it('does not include page param when page is 1', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ page: 1 }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).not.toContain('page=')
  })

  it('constructs key with multiple filters', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useSources({ bias: 'center', factuality: 'very-high', search: 'reuters' }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('bias=center')
    expect(calledKey).toContain('factuality=very-high')
    expect(calledKey).toContain('search=reuters')
  })

  it('exposes mutate function', () => {
    const mutateFn = jest.fn()
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
    } as any)

    const { result } = renderHook(() => useSources())

    expect(result.current.mutate).toBe(mutateFn)
  })
})
