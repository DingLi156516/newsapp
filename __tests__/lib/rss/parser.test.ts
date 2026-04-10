const mockParseURL = vi.fn()

vi.mock('rss-parser', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      parseURL: mockParseURL,
    })),
  }
})

describe('parseFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  async function loadParseFeed() {
    const mod = await import('@/lib/rss/parser')
    return mod.parseFeed
  }

  it('parses feed items with all fields', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          title: ' Test Article ',
          link: ' https://example.com/article ',
          contentSnippet: ' Short description ',
          content: '<p>Full content</p>',
          isoDate: '2026-03-01T12:00:00Z',
          enclosure: { url: 'https://example.com/image.jpg', type: 'image/jpeg' },
        },
      ],
    })

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      title: 'Test Article',
      url: 'https://example.com/article',
      description: 'Short description',
      content: '<p>Full content</p>',
      imageUrl: 'https://example.com/image.jpg',
      publishedAt: '2026-03-01T12:00:00.000Z',
    })
  })

  it('filters items without title or link', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        { title: 'Valid', link: 'https://example.com/valid' },
        { title: '', link: 'https://example.com/no-title' },
        { title: 'No Link', link: undefined },
        { title: undefined, link: undefined },
      ],
    })

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Valid')
  })

  it('handles missing optional fields', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        { title: 'Minimal', link: 'https://example.com/minimal' },
      ],
    })

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    expect(items).toHaveLength(1)
    expect(items[0].description).toBeNull()
    expect(items[0].content).toBeNull()
    expect(items[0].imageUrl).toBeNull()
  })

  it('falls back to summary when contentSnippet is missing', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          title: 'Article',
          link: 'https://example.com/article',
          summary: 'Summary text',
        },
      ],
    })

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    expect(items[0].description).toBe('Summary text')
  })

  it('returns null publishedAt for invalid date strings', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          title: 'Article',
          link: 'https://example.com/article',
          isoDate: 'not-a-date',
        },
      ],
    })

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    // Rather than fabricating "now", we expose the missing-date signal so
    // the ingestion layer can mark the row as published_at_estimated = true.
    expect(items[0].publishedAt).toBeNull()
  })

  it('returns null publishedAt when both isoDate and pubDate are absent', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        { title: 'No Date', link: 'https://example.com/no-date' },
      ],
    })

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    expect(items[0].publishedAt).toBeNull()
  })

  it('handles empty feed', async () => {
    mockParseURL.mockResolvedValue({ items: [] })

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    expect(items).toEqual([])
  })

  it('handles feed with undefined items', async () => {
    mockParseURL.mockResolvedValue({})

    const parseFeed = await loadParseFeed()
    const items = await parseFeed('https://example.com/feed')

    expect(items).toEqual([])
  })
})
