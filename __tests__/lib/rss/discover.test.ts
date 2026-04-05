import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverRssFeeds, validatePublicUrl } from '@/lib/rss/discover'

const originalFetch = global.fetch

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

function mockResponse(body: string, options: { ok?: boolean; headers?: Record<string, string> } = {}): Response {
  const { ok = true, headers = {} } = options
  return {
    ok,
    status: ok ? 200 : 404,
    headers: new Headers(headers),
    text: () => Promise.resolve(body),
  } as unknown as Response
}

describe('validatePublicUrl', () => {
  it('rejects http://127.0.0.1', () => {
    expect(() => validatePublicUrl('http://127.0.0.1')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://localhost', () => {
    expect(() => validatePublicUrl('http://localhost')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://10.0.0.1', () => {
    expect(() => validatePublicUrl('http://10.0.0.1')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://172.16.0.1', () => {
    expect(() => validatePublicUrl('http://172.16.0.1')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://192.168.1.1', () => {
    expect(() => validatePublicUrl('http://192.168.1.1')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://169.254.169.254 (AWS IMDS)', () => {
    expect(() => validatePublicUrl('http://169.254.169.254')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://0.0.0.0', () => {
    expect(() => validatePublicUrl('http://0.0.0.0')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects ftp://example.com', () => {
    expect(() => validatePublicUrl('ftp://example.com')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[::1]', () => {
    expect(() => validatePublicUrl('http://[::1]')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[::] (unspecified address)', () => {
    expect(() => validatePublicUrl('http://[::]/path')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[fc00::1] (unique local)', () => {
    expect(() => validatePublicUrl('http://[fc00::1]/path')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[fd12:3456::1] (unique local)', () => {
    expect(() => validatePublicUrl('http://[fd12:3456::1]/path')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[fe80::1] (link-local)', () => {
    expect(() => validatePublicUrl('http://[fe80::1]/path')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[::ffff:127.0.0.1] (IPv4-mapped loopback)', () => {
    expect(() => validatePublicUrl('http://[::ffff:127.0.0.1]')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[::ffff:169.254.169.254] (IPv4-mapped IMDS)', () => {
    expect(() => validatePublicUrl('http://[::ffff:169.254.169.254]')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[::ffff:10.0.0.1] (IPv4-mapped private)', () => {
    expect(() => validatePublicUrl('http://[::ffff:10.0.0.1]')).toThrow('URL targets a private or reserved network address')
  })

  it('rejects http://[::ffff:192.168.1.1] (IPv4-mapped private)', () => {
    expect(() => validatePublicUrl('http://[::ffff:192.168.1.1]')).toThrow('URL targets a private or reserved network address')
  })

  it('accepts https://reuters.com', () => {
    expect(() => validatePublicUrl('https://reuters.com')).not.toThrow()
  })
})

describe('discoverRssFeeds', () => {
  it('discovers feeds from HTML link tags', async () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="/feed" title="Main Feed" />
        </head>
        <body></body>
      </html>
    `

    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr === 'https://example.com') {
        return Promise.resolve(mockResponse(html))
      }
      return Promise.resolve(mockResponse('', { ok: false }))
    })

    const feeds = await discoverRssFeeds('https://example.com')

    expect(feeds.some((f) => f.url === 'https://example.com/feed' && f.source === 'html-link')).toBe(true)
    expect(feeds.find((f) => f.url === 'https://example.com/feed')?.title).toBe('Main Feed')
  })

  it('discovers feeds from common paths', async () => {
    const emptyHtml = '<html><head></head><body></body></html>'

    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr === 'https://example.com') {
        return Promise.resolve(mockResponse(emptyHtml))
      }
      if (urlStr === 'https://example.com/feed') {
        return Promise.resolve(
          mockResponse('<rss version="2.0"><channel></channel></rss>', {
            headers: { 'content-type': 'application/rss+xml' },
          })
        )
      }
      return Promise.resolve(mockResponse('', { ok: false }))
    })

    const feeds = await discoverRssFeeds('https://example.com')

    expect(feeds.some((f) => f.url === 'https://example.com/feed' && f.source === 'common-path')).toBe(true)
  })

  it('deduplicates URLs found via both HTML and probing', async () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="https://example.com/feed" title="RSS" />
        </head>
        <body></body>
      </html>
    `

    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr === 'https://example.com') {
        return Promise.resolve(mockResponse(html))
      }
      if (urlStr === 'https://example.com/feed') {
        return Promise.resolve(
          mockResponse('<rss version="2.0"><channel></channel></rss>', {
            headers: { 'content-type': 'application/rss+xml' },
          })
        )
      }
      return Promise.resolve(mockResponse('', { ok: false }))
    })

    const feeds = await discoverRssFeeds('https://example.com')

    const feedUrls = feeds.map((f) => f.url)
    const uniqueUrls = [...new Set(feedUrls)]
    expect(feedUrls.length).toBe(uniqueUrls.length)
    expect(feeds.filter((f) => f.url === 'https://example.com/feed')).toHaveLength(1)
    expect(feeds.find((f) => f.url === 'https://example.com/feed')?.source).toBe('html-link')
  })

  it('filters out discovered feeds with private URLs', async () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="http://169.254.169.254/latest" title="IMDS" />
          <link rel="alternate" type="application/rss+xml" href="/feed" title="Main Feed" />
        </head>
        <body></body>
      </html>
    `

    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr === 'https://example.com') {
        return Promise.resolve(mockResponse(html))
      }
      return Promise.resolve(mockResponse('', { ok: false }))
    })

    const feeds = await discoverRssFeeds('https://example.com')

    expect(feeds.some((f) => f.url.includes('169.254'))).toBe(false)
    expect(feeds.some((f) => f.url === 'https://example.com/feed')).toBe(true)
  })

  it('returns empty array when no feeds found', async () => {
    const emptyHtml = '<html><head></head><body></body></html>'

    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr === 'https://example.com') {
        return Promise.resolve(mockResponse(emptyHtml))
      }
      return Promise.resolve(mockResponse('', { ok: false }))
    })

    const feeds = await discoverRssFeeds('https://example.com')

    expect(feeds).toEqual([])
  })

  it('handles fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const feeds = await discoverRssFeeds('https://example.com')

    expect(feeds).toEqual([])
  })

  it('resolves relative URLs against base URL', async () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/atom+xml" href="/blog/atom.xml" title="Blog Atom" />
          <link rel="alternate" type="application/rss+xml" href="rss.xml" title="Relative RSS" />
        </head>
        <body></body>
      </html>
    `

    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr === 'https://example.com/news') {
        return Promise.resolve(mockResponse(html))
      }
      return Promise.resolve(mockResponse('', { ok: false }))
    })

    const feeds = await discoverRssFeeds('https://example.com/news')

    expect(feeds.some((f) => f.url === 'https://example.com/blog/atom.xml')).toBe(true)
    expect(feeds.some((f) => f.url === 'https://example.com/rss.xml')).toBe(true)
  })
})
