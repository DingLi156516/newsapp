import { renderHook } from '@testing-library/react-native'
import useSWR from 'swr'
import { useStories } from '@/lib/hooks/use-stories'

jest.mock('swr')
const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

const mockStories = [
  { id: 'story-1', headline: 'Test Story 1', topic: 'politics', sourceCount: 5 },
  { id: 'story-2', headline: 'Test Story 2', topic: 'economy', sourceCount: 3 },
]

describe('useStories', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns stories from API data', () => {
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

    const { result } = renderHook(() => useStories())

    expect(result.current.stories).toEqual(mockStories)
    expect(result.current.total).toBe(2)
    expect(result.current.page).toBe(1)
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

    const { result } = renderHook(() => useStories())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.total).toBe(0)
    expect(result.current.stories).toEqual([])
  })

  it('sets isError when SWR returns an error', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Network failure'),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    const { result } = renderHook(() => useStories())

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

    renderHook(() => useStories())

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories',
      expect.any(Object)
    )
  })

  it('constructs correct SWR key with topic filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useStories({ topic: 'politics' }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('/api/stories')
    expect(calledKey).toContain('topic=politics')
  })

  it('constructs correct SWR key with search filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useStories({ search: 'climate' }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('search=climate')
  })

  it('constructs correct SWR key with blindspot filter', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useStories({ blindspot: true }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('blindspot=true')
  })

  it('constructs correct SWR key with pagination', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useStories({ page: 3, limit: 10 }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).toContain('page=3')
    expect(calledKey).toContain('limit=10')
  })

  it('does not include page param when page is 1', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as any)

    renderHook(() => useStories({ page: 1 }))

    const calledKey = mockUseSWR.mock.calls[0][0] as string
    expect(calledKey).not.toContain('page=')
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

    const { result } = renderHook(() => useStories())

    expect(result.current.mutate).toBe(mutateFn)
  })
})
