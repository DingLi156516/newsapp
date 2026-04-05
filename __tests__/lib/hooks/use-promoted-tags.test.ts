import { renderHook } from '@testing-library/react'
import useSWR from 'swr'
import { usePromotedTags } from '@/lib/hooks/use-promoted-tags'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

const mockUseSWR = vi.mocked(useSWR)

const mockTags = [
  { slug: 'donald-trump', label: 'Donald Trump', type: 'person', storyCount: 47, relevance: 1 },
  { slug: 'nato', label: 'NATO', type: 'organization', storyCount: 23, relevance: 1 },
]

describe('usePromotedTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls useSWR with /api/tags/promoted', () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, data: mockTags },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    renderHook(() => usePromotedTags())

    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/tags/promoted',
      expect.any(Function),
      expect.objectContaining({ dedupingInterval: 60_000 })
    )
  })

  it('returns tags from API response', () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, data: mockTags },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => usePromotedTags())

    expect(result.current.tags).toEqual(mockTags)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('returns empty array when data is undefined', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => usePromotedTags())

    expect(result.current.tags).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('reports error state', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Network error'),
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() => usePromotedTags())

    expect(result.current.isError).toBe(true)
    expect(result.current.tags).toEqual([])
  })
})
