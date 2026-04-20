import { ingestAllSources } from '@/lib/ingestion/ingest'

vi.mock('@/lib/ingestion/source-registry', () => ({
  getActiveSources: vi.fn(),
  groupByType: vi.fn(),
}))

vi.mock('@/lib/ingestion/pipeline-helpers', () => ({
  toArticleInsert: vi.fn((item, sourceId) => ({
    source_id: sourceId,
    title: item.title,
    url: item.url,
    canonical_url: item.url,
    published_at: item.publishedAt,
  })),
  capArticlesPerSource: vi.fn((items) => items),
  deduplicateItems: vi.fn((_client, items) => items),
  batchInsertArticles: vi.fn().mockResolvedValue({ totalInserted: 0, insertedBySource: new Map() }),
  updateSourceHealth: vi.fn().mockResolvedValue(undefined),
  getCanonicalIdentity: vi.fn((url) => url),
}))

vi.mock('@/lib/ingestion/rss-fetcher', () => ({
  rssFetcher: {
    sourceType: 'rss',
    fetch: vi.fn().mockResolvedValue({ items: [], error: null }),
  },
}))

vi.mock('@/lib/crawler/fetcher', () => ({
  crawlerFetcher: {
    sourceType: 'crawler',
    fetch: vi.fn().mockResolvedValue({ items: [], error: null }),
  },
}))

vi.mock('@/lib/news-api/fetcher', () => ({
  createNewsApiFetcher: vi.fn(() => ({
    sourceType: 'news_api',
    fetch: vi.fn().mockResolvedValue({
      items: [],
      error: { slug: 'mock', name: 'mock', error: 'Invalid news API config', errorType: 'unknown' },
    }),
  })),
}))

import { getActiveSources, groupByType } from '@/lib/ingestion/source-registry'
import { batchInsertArticles, updateSourceHealth, deduplicateItems } from '@/lib/ingestion/pipeline-helpers'
import { rssFetcher } from '@/lib/ingestion/rss-fetcher'
import type { IngestionSource } from '@/lib/ingestion/types'

const mockClient = {} as never

function makeSource(overrides: Partial<IngestionSource> = {}): IngestionSource {
  return {
    sourceId: 'src-1',
    slug: 'test-source',
    name: 'Test Source',
    sourceType: 'rss',
    rssUrl: 'https://test.com/feed',
    config: {},
    ...overrides,
  }
}

describe('ingestAllSources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero counts when no active sources', async () => {
    vi.mocked(getActiveSources).mockResolvedValue([])
    vi.mocked(groupByType).mockReturnValue(new Map())
    vi.mocked(batchInsertArticles).mockResolvedValue({ totalInserted: 0, insertedBySource: new Map() })

    const result = await ingestAllSources(mockClient)

    expect(result.totalSources).toBe(0)
    expect(result.successfulSources).toBe(0)
    expect(result.failedSources).toBe(0)
    expect(result.newArticles).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('fetches from registered fetchers and returns results', async () => {
    const source = makeSource()
    vi.mocked(getActiveSources).mockResolvedValue([source])
    vi.mocked(groupByType).mockReturnValue(new Map([['rss', [source]]]))

    const mockItems = [
      { title: 'Article 1', url: 'https://test.com/1', description: null, content: null, imageUrl: null, publishedAt: '2024-01-01T00:00:00Z', categories: null },
    ]

    vi.mocked(rssFetcher.fetch).mockResolvedValue({ items: mockItems, error: null })

    vi.mocked(deduplicateItems).mockResolvedValue(
      mockItems.map((item) => ({ item, sourceId: source.sourceId }))
    )
    vi.mocked(batchInsertArticles).mockResolvedValue({
      totalInserted: 1,
      insertedBySource: new Map([[source.sourceId, 1]]),
    })

    const result = await ingestAllSources(mockClient)

    expect(result.totalSources).toBe(1)
    expect(result.newArticles).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(updateSourceHealth).toHaveBeenCalledTimes(1)
  })

  it('records errors for failed fetches', async () => {
    const source = makeSource()
    vi.mocked(getActiveSources).mockResolvedValue([source])
    vi.mocked(groupByType).mockReturnValue(new Map([['rss', [source]]]))

    vi.mocked(rssFetcher.fetch).mockResolvedValue({
      items: [],
      error: { slug: 'test-source', name: 'Test Source', error: 'Feed timeout', errorType: 'timeout' },
    })

    vi.mocked(batchInsertArticles).mockResolvedValue({ totalInserted: 0, insertedBySource: new Map() })

    const result = await ingestAllSources(mockClient)

    expect(result.failedSources).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].errorType).toBe('timeout')
  })

  it('records errors for sources with invalid config', async () => {
    const source = makeSource({ sourceType: 'news_api', config: {} })
    vi.mocked(getActiveSources).mockResolvedValue([source])
    vi.mocked(groupByType).mockReturnValue(new Map([['news_api', [source]]]))
    vi.mocked(batchInsertArticles).mockResolvedValue({ totalInserted: 0, insertedBySource: new Map() })

    const result = await ingestAllSources(mockClient)

    expect(result.failedSources).toBe(1)
    expect(result.errors[0].error).toContain('Invalid news API config')
  })

  it('populates byType breakdowns', async () => {
    const rssSource = makeSource({ sourceId: 'rss-1' })
    vi.mocked(getActiveSources).mockResolvedValue([rssSource])
    vi.mocked(groupByType).mockReturnValue(new Map([['rss', [rssSource]]]))

    vi.mocked(rssFetcher.fetch).mockResolvedValue({ items: [], error: null })

    vi.mocked(batchInsertArticles).mockResolvedValue({ totalInserted: 0, insertedBySource: new Map() })

    const result = await ingestAllSources(mockClient)

    expect(result.byType.rss.total).toBe(1)
    expect(result.byType.rss.successful).toBe(1)
    expect(result.byType.crawler.total).toBe(0)
    expect(result.byType.news_api.total).toBe(0)
  })
})
