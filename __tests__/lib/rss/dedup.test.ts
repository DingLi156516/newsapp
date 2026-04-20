import { filterNewArticles } from '@/lib/rss/dedup'
import type { ParsedFeedItem } from '@/lib/rss/parser'

function createMockClient(responses: Array<{
  data?: Array<{ canonical_url?: string | null; url?: string; title_fingerprint?: string | null }> | null
  error?: { message: string } | null
}>) {
  let callIndex = 0
  const returnsMock = vi.fn().mockImplementation(() => {
    const response = responses[callIndex] ?? { data: [], error: null }
    callIndex++
    return Promise.resolve(response)
  })
  const urlInMock = vi.fn().mockReturnValue({ returns: returnsMock })

  // Fingerprint query path: select('title_fingerprint').eq('source_id').in(...)
  // resolves directly (no trailing .returns()).
  const fingerprintInMock = vi.fn().mockImplementation(() => {
    const response = responses[callIndex] ?? { data: [], error: null }
    callIndex++
    return Promise.resolve(response)
  })
  const fingerprintEqMock = vi.fn().mockReturnValue({ in: fingerprintInMock })

  return {
    from: vi.fn(() => ({
      select: vi.fn((columns?: string) => {
        if (columns === 'title_fingerprint') {
          return { eq: fingerprintEqMock }
        }
        return { in: urlInMock }
      }),
    })),
  } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>
}

function makeFeedItem(url: string, title = 'Test'): ParsedFeedItem {
  return {
    title,
    url,
    description: null,
    content: null,
    imageUrl: null,
    publishedAt: '2026-01-01T00:00:00Z',
    categories: null,
  }
}

describe('filterNewArticles', () => {
  it('returns all items when none exist in DB', async () => {
    const client = createMockClient([{ data: [] }])
    const items = [makeFeedItem('https://a.com'), makeFeedItem('https://b.com')]

    const result = await filterNewArticles(client as never, items)

    expect(result).toHaveLength(2)
  })

  it('filters out items that already exist in DB', async () => {
    const client = createMockClient([{ data: [{ canonical_url: 'https://a.com/path', url: 'https://a.com/path' }] }])
    const items = [makeFeedItem('https://a.com/path?utm_source=rss'), makeFeedItem('https://b.com')]

    const result = await filterNewArticles(client as never, items)

    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://b.com')
  })

  it('filters out items that already exist by raw legacy url', async () => {
    const client = createMockClient([
      { data: [] },
      { data: [{ url: 'https://a.com/path?utm_source=rss' }] },
    ])
    const items = [makeFeedItem('https://a.com/path?utm_source=rss'), makeFeedItem('https://b.com')]

    const result = await filterNewArticles(client as never, items)

    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://b.com')
  })

  it('returns empty array for empty input', async () => {
    const client = createMockClient([])

    const result = await filterNewArticles(client as never, [])

    expect(result).toEqual([])
  })

  it('throws on database error', async () => {
    const client = createMockClient([
      { error: { message: 'query failed' } },
    ])
    const items = [makeFeedItem('https://a.com')]

    await expect(filterNewArticles(client as never, items)).rejects.toThrow(
      'Dedup query failed'
    )
  })

  it('handles null data response', async () => {
    const client = createMockClient([{ data: null }])
    const items = [makeFeedItem('https://a.com')]

    const result = await filterNewArticles(client as never, items)

    expect(result).toHaveLength(1)
  })

  describe('AMP / mobile variant dedup', () => {
    it('treats amp.example.com and example.com as the same article', async () => {
      const client = createMockClient([
        { data: [{ canonical_url: 'https://example.com/story', url: 'https://example.com/story' }] },
      ])

      const items = [
        makeFeedItem('https://amp.example.com/story'),
        makeFeedItem('https://m.example.com/story'),
      ]

      const result = await filterNewArticles(client as never, items)
      expect(result).toHaveLength(0)
    })

    it('collapses amp subdomain + /amp/ path + tracking params to a single dedup', async () => {
      const client = createMockClient([
        { data: [{ canonical_url: 'https://example.com/story', url: 'https://example.com/story' }] },
      ])

      const items = [
        makeFeedItem('https://amp.example.com/amp/story?utm_source=facebook'),
      ]

      const result = await filterNewArticles(client as never, items)
      expect(result).toHaveLength(0)
    })
  })

  describe('title-fingerprint dedup (scoped to source)', () => {
    it('filters out same-source republished articles with a new URL', async () => {
      const client = createMockClient([
        // url/canonical check returns nothing
        { data: [] },
        { data: [] },
        // fingerprint check for source-a returns an existing row
        { data: [{ title_fingerprint: 'breaking major event' }] },
      ])

      const items = [
        { item: makeFeedItem('https://example.com/new-url', 'Breaking: major event'), sourceId: 'source-a' },
      ]

      const result = await filterNewArticles(client as never, items)
      expect(result).toHaveLength(0)
    })

    it('does NOT dedup the same title across different sources', async () => {
      const client = createMockClient([
        // url/canonical check returns nothing
        { data: [] },
        { data: [] },
        // fingerprint check for source-a: no match (DB only has the title under source-b)
        { data: [] },
      ])

      const items = [
        { item: makeFeedItem('https://example.com/story', 'Breaking: major event'), sourceId: 'source-a' },
      ]

      const result = await filterNewArticles(client as never, items)
      expect(result).toHaveLength(1)
    })
  })
})
