import { createNewsApiFetcher } from '@/lib/news-api/fetcher'
import type { IngestionSource } from '@/lib/ingestion/types'

vi.mock('@/lib/news-api/rate-limiter', () => ({
  tryAcquireQuota: vi.fn().mockResolvedValue({ acquired: true }),
}))

vi.mock('@/lib/news-api/providers/newsapi', () => ({
  fetchNewsApi: vi.fn(),
}))

vi.mock('@/lib/news-api/providers/gdelt', () => ({
  fetchGdelt: vi.fn(),
}))

import { tryAcquireQuota } from '@/lib/news-api/rate-limiter'
import { fetchNewsApi } from '@/lib/news-api/providers/newsapi'
import { fetchGdelt } from '@/lib/news-api/providers/gdelt'

const mockClient = {} as never
const newsApiFetcher = createNewsApiFetcher(mockClient)

const newsapiSource: IngestionSource = {
  sourceId: 'src-1',
  slug: 'newsapi-us',
  name: 'NewsAPI US',
  sourceType: 'news_api',
  rssUrl: null,
  config: { provider: 'newsapi', country: 'us' },
}

const gdeltSource: IngestionSource = {
  sourceId: 'src-2',
  slug: 'gdelt-climate',
  name: 'GDELT Climate',
  sourceType: 'news_api',
  rssUrl: null,
  config: { provider: 'gdelt', query: 'climate' },
}

describe('newsApiFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tryAcquireQuota).mockResolvedValue({ acquired: true })
  })

  it('has sourceType "news_api"', () => {
    expect(newsApiFetcher.sourceType).toBe('news_api')
  })

  it('returns error for invalid config', async () => {
    const badSource = { ...newsapiSource, config: {} }
    const result = await newsApiFetcher.fetch(badSource)

    expect(result.items).toHaveLength(0)
    expect(result.error?.error).toContain('Invalid news API config')
  })

  it('returns rate_limited when quota exhausted', async () => {
    vi.mocked(tryAcquireQuota).mockResolvedValue({
      acquired: false,
      reason: 'newsapi daily quota exhausted',
    })

    const result = await newsApiFetcher.fetch(newsapiSource)

    expect(result.items).toHaveLength(0)
    expect(result.error?.errorType).toBe('rate_limited')
  })

  it('routes to NewsAPI provider', async () => {
    const mockItems = [{ title: 'Test', url: 'https://test.com', description: null, content: null, imageUrl: null, publishedAt: '2024-01-01T00:00:00Z' }]
    vi.mocked(fetchNewsApi).mockResolvedValue(mockItems)

    const result = await newsApiFetcher.fetch(newsapiSource)

    expect(fetchNewsApi).toHaveBeenCalled()
    expect(fetchGdelt).not.toHaveBeenCalled()
    expect(result.items).toHaveLength(1)
    expect(result.error).toBeNull()
  })

  it('routes to GDELT provider', async () => {
    const mockItems = [{ title: 'Climate', url: 'https://news.com', description: null, content: null, imageUrl: null, publishedAt: '2024-01-01T00:00:00Z' }]
    vi.mocked(fetchGdelt).mockResolvedValue(mockItems)

    const result = await newsApiFetcher.fetch(gdeltSource)

    expect(fetchGdelt).toHaveBeenCalled()
    expect(fetchNewsApi).not.toHaveBeenCalled()
    expect(result.items).toHaveLength(1)
  })

  it('returns api_auth_error for auth failures', async () => {
    vi.mocked(fetchNewsApi).mockRejectedValue(new Error('authentication failed'))

    const result = await newsApiFetcher.fetch(newsapiSource)

    expect(result.error?.errorType).toBe('api_auth_error')
  })

  it('returns rate_limited for 429 errors', async () => {
    vi.mocked(fetchNewsApi).mockRejectedValue(new Error('rate limit exceeded (429)'))

    const result = await newsApiFetcher.fetch(newsapiSource)

    expect(result.error?.errorType).toBe('rate_limited')
  })
})
