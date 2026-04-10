import { fetchNewsApi } from '@/lib/news-api/providers/newsapi'
import type { NewsApiConfig } from '@/lib/news-api/types'

const config: NewsApiConfig = {
  provider: 'newsapi',
  language: 'en',
  country: 'us',
  maxResults: 10,
}

describe('fetchNewsApi', () => {
  const originalEnv = process.env.NEWSAPI_API_KEY

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.NEWSAPI_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    process.env.NEWSAPI_API_KEY = originalEnv
  })

  it('throws when API key is missing', async () => {
    delete process.env.NEWSAPI_API_KEY
    await expect(fetchNewsApi(config)).rejects.toThrow('NEWSAPI_API_KEY')
  })

  it('maps NewsAPI response to ParsedFeedItem[]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        status: 'ok',
        totalResults: 2,
        articles: [
          {
            title: 'Test Article',
            url: 'https://example.com/article',
            description: 'A description',
            content: 'Article content',
            urlToImage: 'https://example.com/image.jpg',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'Another Article',
            url: 'https://example.com/article2',
            description: null,
            content: null,
            urlToImage: null,
            publishedAt: '2024-01-15T11:00:00Z',
          },
        ],
      }), { status: 200 })
    )

    const items = await fetchNewsApi(config)

    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: 'Test Article',
      url: 'https://example.com/article',
      description: 'A description',
      content: 'Article content',
      imageUrl: 'https://example.com/image.jpg',
      publishedAt: '2024-01-15T10:00:00.000Z',
    })
  })

  it('filters out [Removed] articles', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        status: 'ok',
        totalResults: 2,
        articles: [
          { title: '[Removed]', url: 'https://removed.com', description: null, content: null, urlToImage: null, publishedAt: null },
          { title: 'Good Article', url: 'https://example.com/good', description: '[Removed]', content: null, urlToImage: null, publishedAt: '2024-01-01T00:00:00Z' },
          { title: 'Real Article', url: 'https://example.com/real', description: 'desc', content: null, urlToImage: null, publishedAt: '2024-01-01T00:00:00Z' },
        ],
      }), { status: 200 })
    )

    const items = await fetchNewsApi(config)

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Real Article')
  })

  it('throws on 401 authentication error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    )

    await expect(fetchNewsApi(config)).rejects.toThrow('authentication failed')
  })

  it('throws on 429 rate limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Too Many Requests', { status: 429 })
    )

    await expect(fetchNewsApi(config)).rejects.toThrow('rate limit exceeded')
  })
})
