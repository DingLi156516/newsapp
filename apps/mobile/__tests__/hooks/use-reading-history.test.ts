import { renderHook, act } from '@testing-library/react-native'
import useSWR from 'swr'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { authFetch } from '@/lib/hooks/fetcher'

jest.mock('swr')
jest.mock('@/lib/hooks/use-auth')
jest.mock('@/lib/hooks/fetcher', () => ({
  authFetch: jest.fn().mockResolvedValue({ ok: true }),
}))

const mockAddLocal = jest.fn()
const mockRemoveLocal = jest.fn()
const mockLocalIds = new Set<string>()

jest.mock('@/lib/hooks/use-local-reading-history', () => ({
  useLocalReadingHistory: () => ({
    localIds: mockLocalIds,
    addLocal: mockAddLocal,
    removeLocal: mockRemoveLocal,
  }),
}))

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>
const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuth } = require('@/lib/hooks/use-auth')
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('useReadingHistory', () => {
  const mutateFn = jest.fn().mockResolvedValue(undefined)

  afterEach(() => {
    jest.resetAllMocks()
    mockLocalIds.clear()
    mutateFn.mockResolvedValue(undefined)
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

    it('isRead checks local IDs', () => {
      mockLocalIds.add('story-1')

      const { result } = renderHook(() => useReadingHistory())

      expect(result.current.isRead('story-1')).toBe(true)
      expect(result.current.isRead('story-2')).toBe(false)
    })

    it('markAsRead calls addLocal', async () => {
      const { result } = renderHook(() => useReadingHistory())

      await act(async () => {
        await result.current.markAsRead('story-new')
      })

      expect(mockAddLocal).toHaveBeenCalledWith('story-new')
      expect(mockAuthFetch).not.toHaveBeenCalled()
    })

    it('markAsRead skips if already in local IDs', async () => {
      mockLocalIds.add('story-1')

      const { result } = renderHook(() => useReadingHistory())

      await act(async () => {
        await result.current.markAsRead('story-1')
      })

      expect(mockAddLocal).not.toHaveBeenCalled()
    })

    it('markAsUnread calls removeLocal', async () => {
      mockLocalIds.add('story-1')

      const { result } = renderHook(() => useReadingHistory())

      await act(async () => {
        await result.current.markAsUnread('story-1')
      })

      expect(mockRemoveLocal).toHaveBeenCalledWith('story-1')
      expect(mockAuthFetch).not.toHaveBeenCalled()
    })

    it('readStoryIds returns local IDs as array', () => {
      mockLocalIds.add('story-a')
      mockLocalIds.add('story-b')

      const { result } = renderHook(() => useReadingHistory())

      expect(result.current.readStoryIds).toEqual(
        expect.arrayContaining(['story-a', 'story-b'])
      )
      expect(result.current.readStoryIds.length).toBe(2)
    })

    it('readCount returns local IDs size', () => {
      mockLocalIds.add('s1')
      mockLocalIds.add('s2')

      const { result } = renderHook(() => useReadingHistory())

      expect(result.current.readCount).toBe(2)
    })

    it('passes null SWR key when not authenticated', () => {
      renderHook(() => useReadingHistory())

      expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Object))
    })
  })

  describe('authenticated (server path)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-1' },
        session: null,
        isLoading: false,
      })
    })

    it('isRead returns true for server read story ids', () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: ['story-1', 'story-2'] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)

      const { result } = renderHook(() => useReadingHistory())

      expect(result.current.isRead('story-1')).toBe(true)
      expect(result.current.isRead('story-2')).toBe(true)
      expect(result.current.isRead('story-3')).toBe(false)
    })

    it('returns correct readCount', () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: ['s1', 's2', 's3'] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)

      const { result } = renderHook(() => useReadingHistory())

      expect(result.current.readCount).toBe(3)
    })

    it('markAsRead calls authFetch with POST', async () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)
      mockAuthFetch.mockResolvedValue({ ok: true } as Response)

      const { result } = renderHook(() => useReadingHistory())

      await act(async () => {
        await result.current.markAsRead('story-new')
      })

      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/reading-history/story-new',
        { method: 'POST' }
      )
      expect(mutateFn).toHaveBeenCalled()
    })

    it('markAsRead does nothing if story is already read', async () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: ['story-1'] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)

      const { result } = renderHook(() => useReadingHistory())

      await act(async () => {
        await result.current.markAsRead('story-1')
      })

      expect(mockAuthFetch).not.toHaveBeenCalled()
    })

    it('markAsUnread calls authFetch with DELETE', async () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: ['story-1'] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)
      mockAuthFetch.mockResolvedValue({ ok: true } as Response)

      const { result } = renderHook(() => useReadingHistory())

      await act(async () => {
        await result.current.markAsUnread('story-1')
      })

      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/reading-history/story-1',
        { method: 'DELETE' }
      )
    })

    it('passes /api/reading-history key when authenticated', () => {
      mockUseSWR.mockReturnValue({
        data: { success: true, data: [] },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateFn,
      } as any)

      renderHook(() => useReadingHistory())

      expect(mockUseSWR).toHaveBeenCalledWith(
        '/api/reading-history',
        expect.any(Object)
      )
    })
  })
})
