import { cacheStory, uncacheStory, getCachedStory, getCachedStoryIds } from '@/lib/offline/cache-manager'

// Mock the Cache API
const mockCache = {
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
  match: vi.fn(),
  keys: vi.fn(),
}

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
}

// @ts-expect-error - mocking global caches
globalThis.caches = mockCaches

// Mock fetch for cacheStory
const originalFetch = globalThis.fetch

describe('cache-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn()
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  describe('cacheStory', () => {
    it('fetches and caches the story response', async () => {
      const mockResponse = { ok: true, clone: () => mockResponse } as unknown as Response
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse)

      await cacheStory('story-1')

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/stories/story-1')
      expect(mockCaches.open).toHaveBeenCalledWith('axiom-stories-v1')
      expect(mockCache.put).toHaveBeenCalled()
    })

    it('does not cache when fetch fails', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false } as Response)

      await cacheStory('story-1')

      expect(mockCache.put).not.toHaveBeenCalled()
    })
  })

  describe('uncacheStory', () => {
    it('deletes the story from cache', async () => {
      await uncacheStory('story-1')

      expect(mockCache.delete).toHaveBeenCalledWith('/api/stories/story-1')
    })
  })

  describe('getCachedStory', () => {
    it('returns cached story data', async () => {
      const storyData = { success: true, data: { id: 'story-1', headline: 'Test' } }
      mockCache.match.mockResolvedValue({
        json: () => Promise.resolve(storyData),
      })

      const result = await getCachedStory('story-1')

      expect(result).toEqual(storyData)
    })

    it('returns null when not in cache', async () => {
      mockCache.match.mockResolvedValue(null)

      const result = await getCachedStory('story-missing')

      expect(result).toBeNull()
    })
  })

  describe('getCachedStoryIds', () => {
    it('returns story IDs from cache keys', async () => {
      mockCache.keys.mockResolvedValue([
        { url: 'http://localhost:3000/api/stories/s1' },
        { url: 'http://localhost:3000/api/stories/s2' },
      ])

      const ids = await getCachedStoryIds()

      expect(ids).toEqual(['s1', 's2'])
    })

    it('returns empty array when cache is empty', async () => {
      mockCache.keys.mockResolvedValue([])

      const ids = await getCachedStoryIds()

      expect(ids).toEqual([])
    })
  })
})
