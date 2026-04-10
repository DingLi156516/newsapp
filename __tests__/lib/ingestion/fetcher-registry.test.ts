import { registerFetcher, getFetcher, hasFetcher } from '@/lib/ingestion/fetcher-registry'
import type { SourceFetcher } from '@/lib/ingestion/types'

describe('fetcher-registry', () => {
  const mockFetcher: SourceFetcher = {
    sourceType: 'crawler',
    fetch: vi.fn().mockResolvedValue({ items: [], error: null }),
  }

  it('registers and retrieves a fetcher', () => {
    registerFetcher(mockFetcher)
    expect(getFetcher('crawler')).toBe(mockFetcher)
  })

  it('hasFetcher returns true for registered types', () => {
    registerFetcher(mockFetcher)
    expect(hasFetcher('crawler')).toBe(true)
  })

  it('hasFetcher returns false for unregistered types', () => {
    expect(hasFetcher('news_api')).toBe(false)
  })

  it('throws for unregistered source type', () => {
    expect(() => getFetcher('news_api')).toThrow(
      'No fetcher registered for source type: news_api'
    )
  })
})
