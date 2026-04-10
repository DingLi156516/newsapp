import { getActiveSources, groupByType } from '@/lib/ingestion/source-registry'
import type { IngestionSource } from '@/lib/ingestion/types'

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
  const eqMock = vi.fn().mockReturnValue({ order: orderMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })

  return {
    from: vi.fn(() => ({ select: selectMock })),
  } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>
}

describe('getActiveSources', () => {
  it('returns IngestionSource objects for all active sources', async () => {
    const client = createMockClient({
      data: [
        {
          id: 'id-1', slug: 'reuters', name: 'Reuters',
          source_type: 'rss', rss_url: 'https://reuters.com/feed',
          ingestion_config: {},
        },
        {
          id: 'id-2', slug: 'crawler-src', name: 'Crawler Source',
          source_type: 'crawler', rss_url: null,
          ingestion_config: { articleListUrl: 'https://example.com/news' },
        },
      ],
    })

    const sources = await getActiveSources(client as never)

    expect(sources).toHaveLength(2)
    expect(sources[0]).toEqual({
      sourceId: 'id-1',
      slug: 'reuters',
      name: 'Reuters',
      sourceType: 'rss',
      rssUrl: 'https://reuters.com/feed',
      config: {},
    })
    expect(sources[1]).toEqual({
      sourceId: 'id-2',
      slug: 'crawler-src',
      name: 'Crawler Source',
      sourceType: 'crawler',
      rssUrl: null,
      config: { articleListUrl: 'https://example.com/news' },
    })
  })

  it('defaults source_type to rss when null', async () => {
    const client = createMockClient({
      data: [
        {
          id: 'id-1', slug: 'old-source', name: 'Old Source',
          source_type: null, rss_url: 'https://old.com/feed',
          ingestion_config: null,
        },
      ],
    })

    const sources = await getActiveSources(client as never)

    expect(sources[0].sourceType).toBe('rss')
    expect(sources[0].config).toEqual({})
  })

  it('returns empty array when no sources found', async () => {
    const client = createMockClient({ data: [] })
    const sources = await getActiveSources(client as never)
    expect(sources).toEqual([])
  })

  it('throws on database error', async () => {
    const client = createMockClient({ error: { message: 'db down' } })
    await expect(getActiveSources(client as never)).rejects.toThrow(
      'Failed to fetch active sources: db down'
    )
  })
})

describe('groupByType', () => {
  it('groups sources by their sourceType', () => {
    const sources: IngestionSource[] = [
      { sourceId: '1', slug: 'a', name: 'A', sourceType: 'rss', rssUrl: 'https://a.com/feed', config: {} },
      { sourceId: '2', slug: 'b', name: 'B', sourceType: 'crawler', rssUrl: null, config: {} },
      { sourceId: '3', slug: 'c', name: 'C', sourceType: 'rss', rssUrl: 'https://c.com/feed', config: {} },
      { sourceId: '4', slug: 'd', name: 'D', sourceType: 'news_api', rssUrl: null, config: {} },
    ]

    const grouped = groupByType(sources)

    expect(grouped.get('rss')).toHaveLength(2)
    expect(grouped.get('crawler')).toHaveLength(1)
    expect(grouped.get('news_api')).toHaveLength(1)
  })

  it('returns empty map for empty input', () => {
    const grouped = groupByType([])
    expect(grouped.size).toBe(0)
  })
})
