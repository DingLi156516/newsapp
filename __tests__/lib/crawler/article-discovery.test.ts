import { discoverArticleUrls } from '@/lib/crawler/article-discovery'
import type { CrawlerConfig } from '@/lib/crawler/types'

vi.mock('@/lib/crawler/robots', () => ({
  isAllowedByRobots: vi.fn().mockResolvedValue(true),
}))

import { isAllowedByRobots } from '@/lib/crawler/robots'

const config: CrawlerConfig = {
  articleListUrl: 'https://example.com/news',
  articleLinkSelector: 'a.article-link',
  maxArticles: 10,
}

describe('discoverArticleUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAllowedByRobots).mockResolvedValue(true)
  })

  it('discovers article URLs from the page', async () => {
    const html = `
      <html><body>
        <a class="article-link" href="/article/1">Article 1</a>
        <a class="article-link" href="/article/2">Article 2</a>
        <a class="other-link" href="/other">Other</a>
      </body></html>
    `

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, { status: 200 })
    )

    const urls = await discoverArticleUrls(config)

    expect(urls).toHaveLength(2)
    expect(urls[0]).toBe('https://example.com/article/1')
    expect(urls[1]).toBe('https://example.com/article/2')
  })

  it('resolves relative URLs against the article list URL', async () => {
    const html = `
      <html><body>
        <a class="article-link" href="../article/1">Article 1</a>
      </body></html>
    `

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, { status: 200 })
    )

    const urls = await discoverArticleUrls(config)

    expect(urls[0]).toBe('https://example.com/article/1')
  })

  it('deduplicates URLs', async () => {
    const html = `
      <html><body>
        <a class="article-link" href="/article/1">Article 1</a>
        <a class="article-link" href="/article/1">Article 1 Duplicate</a>
      </body></html>
    `

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, { status: 200 })
    )

    const urls = await discoverArticleUrls(config)

    expect(urls).toHaveLength(1)
  })

  it('caps at maxArticles', async () => {
    const links = Array.from({ length: 20 }, (_, i) =>
      `<a class="article-link" href="/article/${i}">Article ${i}</a>`
    ).join('\n')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(`<html><body>${links}</body></html>`, { status: 200 })
    )

    const urls = await discoverArticleUrls({ ...config, maxArticles: 5 })

    expect(urls).toHaveLength(5)
  })

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 })
    )

    await expect(discoverArticleUrls(config)).rejects.toThrow('HTTP 404')
  })
})
