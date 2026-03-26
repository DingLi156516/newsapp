import { ingestFeeds } from '@/lib/rss/ingest'

vi.mock('@/lib/rss/feed-registry', () => ({
  getActiveFeeds: vi.fn(),
}))

vi.mock('@/lib/rss/parser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rss/parser')>()
  return {
    ...actual,
    parseFeed: vi.fn(),
  }
})

vi.mock('@/lib/rss/dedup', () => ({
  filterNewArticles: vi.fn(),
}))

function createMockSourcesChain() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { consecutive_failures: 0, total_articles_ingested: 0 }, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

function createMockClient(overrides?: { upsert?: ReturnType<typeof vi.fn> }) {
  const sourcesChain = createMockSourcesChain()
  const articleUpsert = overrides?.upsert ?? vi.fn().mockResolvedValue({ error: null })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    from: vi.fn((table: string) => {
      if (table === 'sources') return sourcesChain
      return {
        upsert: articleUpsert,
      }
    }),
    _articleUpsert: articleUpsert,
  } as any
}

describe('ingestFeeds', () => {
  const mockClient = createMockClient()

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

    const clientWithInsert = createMockClient()

    const result = await ingestFeeds(clientWithInsert)

    expect(result.totalFeeds).toBe(1)
    expect(result.successfulFeeds).toBe(1)
    expect(result.failedFeeds).toBe(0)
    expect(result.newArticles).toBe(1)
    expect(clientWithInsert._articleUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          canonical_url: 'https://reuters.com/article-1',
          title_fingerprint: 'article 1',
        }),
      ]),
      { onConflict: 'canonical_url', ignoreDuplicates: true }
    )
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

    const failClient = createMockClient({
      upsert: vi.fn().mockResolvedValue({
        error: { message: 'unique constraint violation' },
      }),
    })

    await expect(ingestFeeds(failClient)).rejects.toThrow(
      'Article insert failed: unique constraint violation'
    )
  })

  it('surfaces a clearer message for legacy raw-url uniqueness conflicts', async () => {
    const { getActiveFeeds } = await import('@/lib/rss/feed-registry')
    vi.mocked(getActiveFeeds).mockResolvedValue([
      { sourceId: 's1', slug: 'reuters', name: 'Reuters', rssUrl: 'https://reuters.com/feed' },
    ])

    const { parseFeed } = await import('@/lib/rss/parser')
    vi.mocked(parseFeed).mockResolvedValue([
      {
        title: 'New',
        url: 'https://reuters.com/new?utm_source=rss',
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
        url: 'https://reuters.com/new?utm_source=rss',
        description: null,
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
    ])

    const failClient = createMockClient({
      upsert: vi.fn().mockResolvedValue({
        error: { message: 'duplicate key value violates unique constraint "articles_url_key"' },
      }),
    })

    await expect(ingestFeeds(failClient)).rejects.toThrow(
      'legacy raw-url unique constraint'
    )
  })

  it('collapses batch duplicates that normalize to the same canonical url', async () => {
    const { getActiveFeeds } = await import('@/lib/rss/feed-registry')
    vi.mocked(getActiveFeeds).mockResolvedValue([
      { sourceId: 's1', slug: 'reuters', name: 'Reuters', rssUrl: 'https://reuters.com/feed' },
    ])

    const { parseFeed } = await import('@/lib/rss/parser')
    vi.mocked(parseFeed).mockResolvedValue([
      {
        title: 'Article 1',
        url: 'https://reuters.com/article-1?utm_source=rss',
        description: 'Desc',
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
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
        url: 'https://reuters.com/article-1?utm_source=rss',
        description: 'Desc',
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
      {
        title: 'Article 1',
        url: 'https://reuters.com/article-1',
        description: 'Desc',
        content: null,
        imageUrl: null,
        publishedAt: '2026-03-01T12:00:00Z',
      },
    ])

    const clientWithInsert = createMockClient()

    const result = await ingestFeeds(clientWithInsert)

    expect(result.newArticles).toBe(1)
    expect(clientWithInsert._articleUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          url: 'https://reuters.com/article-1?utm_source=rss',
          canonical_url: 'https://reuters.com/article-1',
        }),
      ],
      { onConflict: 'canonical_url', ignoreDuplicates: true }
    )
  })
})
