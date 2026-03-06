import { getActiveFeeds } from '@/lib/rss/feed-registry'

function createMockClient(overrides: {
  data?: unknown[] | null
  error?: { message: string } | null
}) {
  const result = {
    data: overrides.data ?? null,
    error: overrides.error ?? null,
  }

  const returnsMock = vi.fn().mockResolvedValue(result)
  const orderMock = vi.fn().mockReturnValue({ returns: returnsMock })
  const notMock = vi.fn().mockReturnValue({ order: orderMock })
  const eqMock = vi.fn().mockReturnValue({ not: notMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })

  return {
    from: vi.fn(() => ({ select: selectMock })),
  } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>
}

describe('getActiveFeeds', () => {
  it('returns feed entries for active sources with RSS URLs', async () => {
    const client = createMockClient({
      data: [
        { id: 'id-1', slug: 'reuters', name: 'Reuters', rss_url: 'https://reuters.com/feed' },
        { id: 'id-2', slug: 'bbc', name: 'BBC', rss_url: 'https://bbc.com/feed' },
      ],
    })

    const feeds = await getActiveFeeds(client as never)

    expect(feeds).toHaveLength(2)
    expect(feeds[0]).toEqual({
      sourceId: 'id-1',
      slug: 'reuters',
      name: 'Reuters',
      rssUrl: 'https://reuters.com/feed',
    })
  })

  it('filters out sources with null rss_url', async () => {
    const client = createMockClient({
      data: [
        { id: 'id-1', slug: 'reuters', name: 'Reuters', rss_url: 'https://reuters.com/feed' },
        { id: 'id-2', slug: 'no-rss', name: 'No RSS', rss_url: null },
      ],
    })

    const feeds = await getActiveFeeds(client as never)

    expect(feeds).toHaveLength(1)
    expect(feeds[0].slug).toBe('reuters')
  })

  it('returns empty array when no sources found', async () => {
    const client = createMockClient({ data: [] })

    const feeds = await getActiveFeeds(client as never)

    expect(feeds).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    const client = createMockClient({ data: null })

    const feeds = await getActiveFeeds(client as never)

    expect(feeds).toEqual([])
  })

  it('throws on database error', async () => {
    const client = createMockClient({
      error: { message: 'connection refused' },
    })

    await expect(getActiveFeeds(client as never)).rejects.toThrow(
      'Failed to fetch active feeds: connection refused'
    )
  })
})
