import {
  toArticleInsert,
  getCanonicalIdentity,
  capArticlesPerSource,
} from '@/lib/ingestion/pipeline-helpers'
import type { ParsedFeedItem } from '@/lib/rss/parser'

describe('toArticleInsert', () => {
  it('maps ParsedFeedItem to DbArticleInsert', () => {
    const item: ParsedFeedItem = {
      title: 'Test Article',
      url: 'https://example.com/article?utm_source=test',
      description: 'A test article',
      content: '<p>Content</p>',
      imageUrl: 'https://example.com/image.jpg',
      publishedAt: '2024-01-01T00:00:00.000Z',
    }

    const insert = toArticleInsert(item, 'source-123')

    expect(insert.source_id).toBe('source-123')
    expect(insert.title).toBe('Test Article')
    expect(insert.url).toBe('https://example.com/article?utm_source=test')
    expect(insert.canonical_url).toBe('https://example.com/article')
    expect(insert.title_fingerprint).toBe('test article')
    expect(insert.image_url).toBe('https://example.com/image.jpg')
    expect(insert.published_at).toBe('2024-01-01T00:00:00.000Z')
  })
})

describe('getCanonicalIdentity', () => {
  it('strips tracking params', () => {
    const canonical = getCanonicalIdentity('https://example.com/article?utm_source=test&id=5')
    expect(canonical).toBe('https://example.com/article?id=5')
  })
})

describe('capArticlesPerSource', () => {
  it('caps articles per source to the given max', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      item: {
        title: `Article ${i}`,
        url: `https://example.com/article-${i}`,
        description: null,
        content: null,
        imageUrl: null,
        publishedAt: new Date(2024, 0, 10 - i).toISOString(),
      } as ParsedFeedItem,
      sourceId: 'source-1',
    }))

    const capped = capArticlesPerSource(items, 3)

    expect(capped).toHaveLength(3)
    // Should keep the 3 newest
    expect(capped[0].item.title).toBe('Article 0')
    expect(capped[1].item.title).toBe('Article 1')
    expect(capped[2].item.title).toBe('Article 2')
  })

  it('handles multiple sources independently', () => {
    const items = [
      { item: { title: 'A1', url: 'https://a.com/1', description: null, content: null, imageUrl: null, publishedAt: '2024-01-03T00:00:00Z' } as ParsedFeedItem, sourceId: 'source-a' },
      { item: { title: 'A2', url: 'https://a.com/2', description: null, content: null, imageUrl: null, publishedAt: '2024-01-02T00:00:00Z' } as ParsedFeedItem, sourceId: 'source-a' },
      { item: { title: 'A3', url: 'https://a.com/3', description: null, content: null, imageUrl: null, publishedAt: '2024-01-01T00:00:00Z' } as ParsedFeedItem, sourceId: 'source-a' },
      { item: { title: 'B1', url: 'https://b.com/1', description: null, content: null, imageUrl: null, publishedAt: '2024-01-03T00:00:00Z' } as ParsedFeedItem, sourceId: 'source-b' },
    ]

    const capped = capArticlesPerSource(items, 2)

    const sourceA = capped.filter((e) => e.sourceId === 'source-a')
    const sourceB = capped.filter((e) => e.sourceId === 'source-b')
    expect(sourceA).toHaveLength(2)
    expect(sourceB).toHaveLength(1)
  })
})
