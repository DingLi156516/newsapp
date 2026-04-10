import { fetchGdelt } from '@/lib/news-api/providers/gdelt'
import type { NewsApiConfig } from '@/lib/news-api/types'

const config: NewsApiConfig = {
  provider: 'gdelt',
  query: 'climate change',
  maxResults: 10,
}

describe('fetchGdelt', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps GDELT response to ParsedFeedItem[]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        articles: [
          {
            title: 'Climate Report',
            url: 'https://news.com/climate',
            seendate: '20240115T120000Z',
            socialimage: 'https://news.com/image.jpg',
            domain: 'news.com',
          },
          {
            title: 'Weather Update',
            url: 'https://weather.com/update',
            seendate: '20240115T140000Z',
            domain: 'weather.com',
          },
        ],
      }), { status: 200 })
    )

    const items = await fetchGdelt(config)

    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: 'Climate Report',
      url: 'https://news.com/climate',
      description: null,
      content: null,
      imageUrl: 'https://news.com/image.jpg',
      publishedAt: '2024-01-15T12:00:00.000Z',
    })
    expect(items[1].imageUrl).toBeNull()
  })

  it('returns empty array when no articles', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )

    const items = await fetchGdelt(config)
    expect(items).toEqual([])
  })

  it('filters articles without title or url', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        articles: [
          { title: '', url: 'https://a.com', seendate: '20240101T000000Z', domain: 'a.com' },
          { title: 'Good', url: '', seendate: '20240101T000000Z', domain: 'b.com' },
          { title: 'Valid', url: 'https://c.com', seendate: '20240101T000000Z', domain: 'c.com' },
        ],
      }), { status: 200 })
    )

    const items = await fetchGdelt(config)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Valid')
  })

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Error', { status: 500 })
    )

    await expect(fetchGdelt(config)).rejects.toThrow('GDELT HTTP 500')
  })

  it('handles GDELT date format correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        articles: [
          { title: 'Test', url: 'https://a.com', seendate: '20240320T103045Z', domain: 'a.com' },
        ],
      }), { status: 200 })
    )

    const items = await fetchGdelt(config)
    expect(items[0].publishedAt).toBe('2024-03-20T10:30:45.000Z')
  })
})
