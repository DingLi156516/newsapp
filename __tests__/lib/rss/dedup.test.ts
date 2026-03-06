import { filterNewArticles } from '@/lib/rss/dedup'
import type { ParsedFeedItem } from '@/lib/rss/parser'

function createMockClient(responses: Array<{
  data?: Array<{ url: string }> | null
  error?: { message: string } | null
}>) {
  let callIndex = 0
  const returnsMock = vi.fn().mockImplementation(() => {
    const response = responses[callIndex] ?? { data: [], error: null }
    callIndex++
    return Promise.resolve(response)
  })
  const inMock = vi.fn().mockReturnValue({ returns: returnsMock })

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: inMock,
      })),
    })),
  } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>
}

function makeFeedItem(url: string): ParsedFeedItem {
  return {
    title: 'Test',
    url,
    description: null,
    content: null,
    imageUrl: null,
    publishedAt: '2026-01-01T00:00:00Z',
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
    const client = createMockClient([{ data: [{ url: 'https://a.com' }] }])
    const items = [makeFeedItem('https://a.com'), makeFeedItem('https://b.com')]

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
})
