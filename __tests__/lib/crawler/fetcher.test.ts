import { crawlerFetcher } from '@/lib/crawler/fetcher'
import type { IngestionSource } from '@/lib/ingestion/types'

vi.mock('@/lib/crawler/article-discovery', () => ({
  discoverArticleUrls: vi.fn(),
}))

vi.mock('@/lib/crawler/article-extractor', () => ({
  extractArticle: vi.fn(),
}))

vi.mock('@/lib/crawler/robots', () => ({
  isAllowedByRobots: vi.fn().mockResolvedValue(true),
  clearRobotsCache: vi.fn(),
}))

import { discoverArticleUrls } from '@/lib/crawler/article-discovery'
import { extractArticle } from '@/lib/crawler/article-extractor'

const source: IngestionSource = {
  sourceId: 'src-1',
  slug: 'test-crawler',
  name: 'Test Crawler',
  sourceType: 'crawler',
  rssUrl: null,
  config: {
    articleListUrl: 'https://example.com/news',
    articleLinkSelector: 'a.article',
  },
}

describe('crawlerFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has sourceType "crawler"', () => {
    expect(crawlerFetcher.sourceType).toBe('crawler')
  })

  it('returns error for invalid config', async () => {
    const badSource = { ...source, config: {} }
    const result = await crawlerFetcher.fetch(badSource)

    expect(result.items).toHaveLength(0)
    expect(result.error?.errorType).toBe('unknown')
    expect(result.error?.error).toContain('Invalid crawler config')
  })

  it('discovers and extracts articles', async () => {
    vi.mocked(discoverArticleUrls).mockResolvedValue([
      'https://example.com/article/1',
      'https://example.com/article/2',
    ])

    vi.mocked(extractArticle).mockImplementation(async (url) => ({
      title: `Article from ${url}`,
      url,
      description: 'desc',
      content: '<p>content</p>',
      imageUrl: null,
      publishedAt: '2024-01-01T00:00:00Z',
    }))

    const result = await crawlerFetcher.fetch(source)

    expect(result.items).toHaveLength(2)
    expect(result.error).toBeNull()
    expect(result.items[0].title).toBe('Article from https://example.com/article/1')
  })

  it('returns extraction_failed when all extractions fail', async () => {
    vi.mocked(discoverArticleUrls).mockResolvedValue([
      'https://example.com/article/1',
    ])

    vi.mocked(extractArticle).mockRejectedValue(new Error('extraction failed'))

    const result = await crawlerFetcher.fetch(source)

    expect(result.items).toHaveLength(0)
    expect(result.error?.errorType).toBe('extraction_failed')
  })

  it('returns partial results when some extractions fail', async () => {
    vi.mocked(discoverArticleUrls).mockResolvedValue([
      'https://example.com/article/1',
      'https://example.com/article/2',
    ])

    vi.mocked(extractArticle)
      .mockResolvedValueOnce({
        title: 'Good Article',
        url: 'https://example.com/article/1',
        description: null,
        content: null,
        imageUrl: null,
        publishedAt: '2024-01-01T00:00:00Z',
      })
      .mockRejectedValueOnce(new Error('failed'))

    const result = await crawlerFetcher.fetch(source)

    expect(result.items).toHaveLength(1)
    expect(result.error).toBeNull()
  })
})
