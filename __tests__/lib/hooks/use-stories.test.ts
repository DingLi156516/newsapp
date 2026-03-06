import { renderHook } from '@testing-library/react'
import useSWR from 'swr'
import { useStories } from '@/lib/hooks/use-stories'
import { sampleArticles } from '@/lib/sample-data'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

const mockUseSWR = vi.mocked(useSWR)

const mockResponse = {
  data: {
    success: true,
    data: sampleArticles,
    meta: { total: sampleArticles.length, page: 1, limit: 20 },
  },
  error: undefined,
  isLoading: false,
  mutate: vi.fn(),
  isValidating: false,
}

describe('useStories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSWR.mockReturnValue(mockResponse as ReturnType<typeof useSWR>)
  })

  it('calls useSWR with /api/stories when no params', () => {
    renderHook(() => useStories())
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns stories from API response', () => {
    const { result } = renderHook(() => useStories())
    expect(result.current.stories).toEqual(sampleArticles)
    expect(result.current.total).toBe(sampleArticles.length)
    expect(result.current.page).toBe(1)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('falls back to sampleArticles when data is undefined', () => {
    mockUseSWR.mockReturnValue({
      ...mockResponse,
      data: undefined,
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => useStories())
    expect(result.current.stories).toEqual(sampleArticles)
  })

  it('appends topic param to URL', () => {
    renderHook(() => useStories({ topic: 'politics' }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories?topic=politics',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('appends search param to URL', () => {
    renderHook(() => useStories({ search: 'climate' }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories?search=climate',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('appends blindspot param to URL', () => {
    renderHook(() => useStories({ blindspot: true }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories?blindspot=true',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('appends biasRange when fewer than 7 selected', () => {
    renderHook(() => useStories({ biasRange: ['left', 'center'] }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories?biasRange=left%2Ccenter',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('omits biasRange when all 7 selected', () => {
    renderHook(() =>
      useStories({
        biasRange: [
          'far-left', 'left', 'lean-left', 'center',
          'lean-right', 'right', 'far-right',
        ],
      })
    )
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('appends minFactuality param', () => {
    renderHook(() => useStories({ minFactuality: 'high' }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories?minFactuality=high',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('appends datePreset when not "all"', () => {
    renderHook(() => useStories({ datePreset: '7d' }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories?datePreset=7d',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('omits datePreset when "all"', () => {
    renderHook(() => useStories({ datePreset: 'all' }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('appends page param when greater than 1', () => {
    renderHook(() => useStories({ page: 2 }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories?page=2',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('omits page param when 1', () => {
    renderHook(() => useStories({ page: 1 }))
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/stories',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('combines multiple params', () => {
    renderHook(() =>
      useStories({
        topic: 'technology',
        search: 'AI',
        biasRange: ['center'],
        datePreset: '24h',
      })
    )
    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining('topic=technology'),
      expect.any(Function),
      expect.any(Object)
    )
    const url = mockUseSWR.mock.calls[0][0] as string
    expect(url).toContain('search=AI')
    expect(url).toContain('biasRange=center')
    expect(url).toContain('datePreset=24h')
  })

  it('reports isError when SWR has error', () => {
    mockUseSWR.mockReturnValue({
      ...mockResponse,
      error: new Error('Network error'),
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => useStories())
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeDefined()
  })

  it('reports isLoading from SWR', () => {
    mockUseSWR.mockReturnValue({
      ...mockResponse,
      isLoading: true,
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => useStories())
    expect(result.current.isLoading).toBe(true)
  })
})
