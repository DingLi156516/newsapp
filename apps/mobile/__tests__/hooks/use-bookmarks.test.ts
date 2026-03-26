import { renderHook, act } from '@testing-library/react-native'
import useSWR from 'swr'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { authFetch } from '@/lib/hooks/fetcher'

jest.mock('swr')
jest.mock('@/lib/hooks/use-auth')
jest.mock('@/lib/hooks/fetcher', () => ({
  authFetch: jest.fn().mockResolvedValue({ ok: true }),
}))
jest.mock('@/lib/offline/cache-manager', () => ({
  cacheStory: jest.fn(),
  uncacheStory: jest.fn(),
}))

const mockLocalBookmarks = {
  localIds: new Set<string>(),
  isLoaded: true,
  addLocal: jest.fn(),
  removeLocal: jest.fn(),
  clearLocal: jest.fn(),
}
jest.mock('@/lib/hooks/use-local-bookmarks', () => ({
  useLocalBookmarks: () => mockLocalBookmarks,
}))

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>
const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuth } = require('@/lib/hooks/use-auth')
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('useBookmarks', () => {
  const mutateFn = jest.fn().mockResolvedValue(undefined)

  afterEach(() => {
    jest.resetAllMocks()
    mutateFn.mockResolvedValue(undefined)
    mockLocalBookmarks.localIds = new Set()
    mockLocalBookmarks.addLocal = jest.fn()
    mockLocalBookmarks.removeLocal = jest.fn()
    mockLocalBookmarks.clearLocal = jest.fn()
  })

  describe('authenticated (server path)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-1' },
        session: null,
        isLoading: false,
      })
    })

    it('returns isBookmarked true for bookmarked story ids', () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: ['story-1', 'story-2'] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)

      const { result } = renderHook(() => useBookmarks())

      expect(result.current.isBookmarked('story-1')).toBe(true)
      expect(result.current.isBookmarked('story-2')).toBe(true)
      expect(result.current.isBookmarked('story-3')).toBe(false)
    })

    it('returns correct bookmark count', () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: ['story-1', 'story-2', 'story-3'] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)

      const { result } = renderHook(() => useBookmarks())

      expect(result.current.count).toBe(3)
    })

    it('toggle calls mutate and authFetch', async () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)
      mockAuthFetch.mockResolvedValue({ ok: true } as Response)

      const { result } = renderHook(() => useBookmarks())

      await act(async () => {
        await result.current.toggle('story-new')
      })

      expect(mutateFn).toHaveBeenCalled()
      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/bookmarks',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('toggle removes bookmark when already bookmarked', async () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: ['story-1'] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)
      mockAuthFetch.mockResolvedValue({ ok: true } as Response)

      const { result } = renderHook(() => useBookmarks())

      await act(async () => {
        await result.current.toggle('story-1')
      })

      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/bookmarks/story-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('passes /api/bookmarks SWR key', () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)

      renderHook(() => useBookmarks())

      expect(mockUseSWR).toHaveBeenCalledWith(
        '/api/bookmarks',
        expect.any(Object)
      )
    })
  })

  describe('unauthenticated (local path)', () => {
    beforeEach(() => {
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
    })

    it('passes null SWR key', () => {
      renderHook(() => useBookmarks())

      expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Object))
    })

    it('isBookmarked checks localIds', () => {
      mockLocalBookmarks.localIds = new Set(['story-local'])

      const { result } = renderHook(() => useBookmarks())

      expect(result.current.isBookmarked('story-local')).toBe(true)
      expect(result.current.isBookmarked('story-other')).toBe(false)
    })

    it('toggle calls addLocal for new bookmark', async () => {
      const { result } = renderHook(() => useBookmarks())

      let toggleResult: string | undefined
      await act(async () => {
        toggleResult = await result.current.toggle('story-new')
      })

      expect(toggleResult).toBe('toggled')
      expect(mockLocalBookmarks.addLocal).toHaveBeenCalledWith('story-new')
      expect(mockAuthFetch).not.toHaveBeenCalled()
    })

    it('toggle calls removeLocal for existing bookmark', async () => {
      mockLocalBookmarks.localIds = new Set(['story-1'])

      const { result } = renderHook(() => useBookmarks())

      await act(async () => {
        await result.current.toggle('story-1')
      })

      expect(mockLocalBookmarks.removeLocal).toHaveBeenCalledWith('story-1')
    })

    it('returns local bookmark count', () => {
      mockLocalBookmarks.localIds = new Set(['s1', 's2'])

      const { result } = renderHook(() => useBookmarks())

      expect(result.current.count).toBe(2)
    })

    it('returns localIds as bookmarkedIds', () => {
      mockLocalBookmarks.localIds = new Set(['s1', 's2'])

      const { result } = renderHook(() => useBookmarks())

      expect(result.current.bookmarkedIds).toBe(mockLocalBookmarks.localIds)
    })
  })
})
