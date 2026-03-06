import { ingestFeeds } from '@/lib/rss/ingest'

vi.mock('@/lib/rss/feed-registry', () => ({
  getActiveFeeds: vi.fn(),
}))

vi.mock('@/lib/rss/parser', () => ({
  parseFeed: vi.fn(),
}))

vi.mock('@/lib/rss/dedup', () => ({
  filterNewArticles: vi.fn(),
}))

describe('ingestFeeds', () => {
  const mockClient = {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero counts when no feeds are active', async () => {
    const { getActiveFeeds } = await import('@/lib/rss/feed-registry')
    vi.mocked(getActiveFeeds).mockResolvedValue([])

    const { filterNewArticles } = await import('@/lib/rss/dedup')
    vi.mocked(filterNewArticles).mockResolvedValue([])

    const result = await ingestFeeds(mockClient)

    expect(result.totalFeeds).toBe(0)
    expect(result.successfulFeeds).toBe(0)
    expect(result.newArticles).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('ingests articles from successful feeds', async () => {
    const { getActiveFeeds } = await import('@/lib/rss/feed-registry')
    vi.mocked(getActiveFeeds).mockResolvedValue([
      { sourceId: 's1', slug: 'reuters', name: 'Reuters', rssUrl: 'https://reuters.com/feed' },
    ])

    const { parseFeed } = await import('@/lib/rss/parser')
    vi.mocked(parseFeed).mockResolvedValue([
      {
        title: 'Article 1',
        url: 'https://reuters.com/article-1',
        description: 'Desc',
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
    ])

    const { filterNewArticles } = await import('@/lib/rss/dedup')
    vi.mocked(filterNewArticles).mockResolvedValue([
      {
        title: 'Article 1',
        url: 'https://reuters.com/article-1',
        description: 'Desc',
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
    ])

    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const clientWithInsert = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    } as never

    const result = await ingestFeeds(clientWithInsert)

    expect(result.totalFeeds).toBe(1)
    expect(result.successfulFeeds).toBe(1)
    expect(result.failedFeeds).toBe(0)
    expect(result.newArticles).toBe(1)
  })

  it('records errors for feeds that fail to parse', async () => {
    const { getActiveFeeds } = await import('@/lib/rss/feed-registry')
    vi.mocked(getActiveFeeds).mockResolvedValue([
      { sourceId: 's1', slug: 'broken', name: 'Broken Feed', rssUrl: 'https://broken.com/feed' },
    ])

    const { parseFeed } = await import('@/lib/rss/parser')
    vi.mocked(parseFeed).mockRejectedValue(new Error('Network timeout'))

    const { filterNewArticles } = await import('@/lib/rss/dedup')
    vi.mocked(filterNewArticles).mockResolvedValue([])

    const result = await ingestFeeds(mockClient)

    expect(result.totalFeeds).toBe(1)
    expect(result.failedFeeds).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].slug).toBe('broken')
    expect(result.errors[0].error).toBe('Network timeout')
  })

  it('skips duplicate articles', async () => {
    const { getActiveFeeds } = await import('@/lib/rss/feed-registry')
    vi.mocked(getActiveFeeds).mockResolvedValue([
      { sourceId: 's1', slug: 'reuters', name: 'Reuters', rssUrl: 'https://reuters.com/feed' },
    ])

    const { parseFeed } = await import('@/lib/rss/parser')
    vi.mocked(parseFeed).mockResolvedValue([
      {
        title: 'Existing',
        url: 'https://reuters.com/existing',
        description: null,
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
    ])

    const { filterNewArticles } = await import('@/lib/rss/dedup')
    vi.mocked(filterNewArticles).mockResolvedValue([])

    const result = await ingestFeeds(mockClient)

    expect(result.newArticles).toBe(0)
  })

  it('throws on insert failure', async () => {
    const { getActiveFeeds } = await import('@/lib/rss/feed-registry')
    vi.mocked(getActiveFeeds).mockResolvedValue([
      { sourceId: 's1', slug: 'reuters', name: 'Reuters', rssUrl: 'https://reuters.com/feed' },
    ])

    const { parseFeed } = await import('@/lib/rss/parser')
    vi.mocked(parseFeed).mockResolvedValue([
      {
        title: 'New',
        url: 'https://reuters.com/new',
        description: null,
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
    ])

    const { filterNewArticles } = await import('@/lib/rss/dedup')
    vi.mocked(filterNewArticles).mockResolvedValue([
      {
        title: 'New',
        url: 'https://reuters.com/new',
        description: null,
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
    ])

    const failClient = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          error: { message: 'unique constraint violation' },
        }),
      })),
    } as never

    await expect(ingestFeeds(failClient)).rejects.toThrow(
      'Article insert failed: unique constraint violation'
    )
  })
})
