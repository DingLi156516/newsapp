import { extractArticle } from '@/lib/crawler/article-extractor'
import type { CrawlerConfig } from '@/lib/crawler/types'

const config: CrawlerConfig = {
  articleListUrl: 'https://example.com/news',
  articleLinkSelector: 'a',
}

describe('extractArticle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts article content via Readability', async () => {
    const html = `
      <html>
        <head>
          <title>Test Article</title>
          <meta property="og:image" content="https://example.com/image.jpg" />
          <meta property="article:published_time" content="2024-01-15T12:00:00Z" />
        </head>
        <body>
          <article>
            <h1>Test Article Title</h1>
            <p>This is a long enough article body that Readability should be able to extract it properly.
            We need several sentences here to ensure the content extraction works correctly.
            The Mozilla Readability library requires a minimum amount of content to identify an article.
            Adding more text helps ensure the extraction algorithm identifies the main content area.
            This paragraph provides additional substance for the content extraction test.</p>
          </article>
        </body>
      </html>
    `

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, { status: 200 })
    )

    const article = await extractArticle('https://example.com/article/1', config)

    expect(article.url).toBe('https://example.com/article/1')
    expect(article.title).toBeTruthy()
    expect(article.imageUrl).toBe('https://example.com/image.jpg')
    expect(article.publishedAt).toBe('2024-01-15T12:00:00.000Z')
  })

  it('falls back to CSS selectors when Readability fails', async () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="A test description" />
          <meta property="og:image" content="https://example.com/img.jpg" />
        </head>
        <body>
          <h1>Fallback Title</h1>
          <div class="content"><p>Short content.</p></div>
        </body>
      </html>
    `

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, { status: 200 })
    )

    const configWithSelectors: CrawlerConfig = {
      ...config,
      titleSelector: 'h1',
      contentSelector: '.content',
    }

    const article = await extractArticle('https://example.com/article/2', configWithSelectors)

    expect(article.title).toBe('Fallback Title')
    expect(article.description).toBe('A test description')
    expect(article.imageUrl).toBe('https://example.com/img.jpg')
  })

  it('extracts published date from time element', async () => {
    const html = `
      <html>
        <body>
          <h1>Date Test</h1>
          <time datetime="2024-03-20T10:30:00Z">March 20, 2024</time>
          <p>Content for date extraction test. This is a substantial paragraph.</p>
        </body>
      </html>
    `

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, { status: 200 })
    )

    const article = await extractArticle('https://example.com/article/3', config)
    expect(article.publishedAt).toBe('2024-03-20T10:30:00.000Z')
  })

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500 })
    )

    await expect(
      extractArticle('https://example.com/article/4', config)
    ).rejects.toThrow('HTTP 500')
  })
})
