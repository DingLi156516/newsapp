/**
 * lib/rss/discover.ts — RSS feed auto-discovery.
 *
 * Given a website URL, discovers RSS/Atom feeds by:
 * 1. Parsing HTML <link> tags from the page
 * 2. Probing common feed paths (/feed, /rss, etc.)
 */

import { lookup } from 'node:dns/promises'
import { validatePublicUrl, isPrivateAddress } from '@/lib/rss/url-validation'

// Re-export for backward compatibility — existing consumers import from here.
export { validatePublicUrl } from '@/lib/rss/url-validation'

/**
 * Async SSRF guard that resolves the hostname via DNS and rejects ANY URL
 * whose resolved IP is private/reserved. Use at fetch boundaries to catch
 * attacker-controlled hostnames like `evil.example.com` → 127.0.0.1.
 *
 * Note: this has a known TOCTOU window — between this check and the
 * subsequent fetch, DNS could theoretically return a different answer.
 * Fully closing the gap requires a custom undici dispatcher with a
 * pinned IP, which is out of scope for this check. The sync literal
 * check + DNS resolution together cover the common attack vectors.
 */
export async function validatePublicUrlWithDns(url: string): Promise<void> {
  // First: sync check catches literal IPs and obvious bad hostnames
  validatePublicUrl(url)

  const parsed = new URL(url)
  const hostname = parsed.hostname.startsWith('[')
    ? parsed.hostname.slice(1, -1)
    : parsed.hostname

  // Skip DNS resolution for literal IPs (already validated above)
  if (/^[0-9.]+$/.test(hostname) || hostname.includes(':')) {
    return
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    // DNS resolution failure — fail closed
    throw new Error(`URL DNS resolution failed: ${hostname}`)
  }

  if (addresses.length === 0) {
    throw new Error(`URL has no DNS records: ${hostname}`)
  }

  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new Error(
        `URL hostname resolves to a private or reserved network address: ${entry.address}`
      )
    }
  }
}

export interface DiscoveredFeed {
  readonly url: string
  readonly source: 'html-link' | 'common-path'
  readonly title?: string
}

const COMMON_FEED_PATHS = [
  '/feed',
  '/rss',
  '/rss.xml',
  '/atom.xml',
  '/feed.xml',
  '/feed/rss',
  '/feed/atom',
  '/index.xml',
  '/feeds/posts/default',
  '/.rss',
] as const

const FEED_CONTENT_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
]

const FETCH_TIMEOUT = 5_000

async function fetchWithTimeout(url: string): Promise<Response | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AxiomNews/1.0 (RSS Discovery)',
        Accept: 'text/html, application/xhtml+xml, application/xml, */*',
      },
      redirect: 'follow',
    })

    clearTimeout(timeout)
    return response
  } catch {
    return null
  }
}

function extractLinksFromHtml(html: string, baseUrl: string): DiscoveredFeed[] {
  const feeds: DiscoveredFeed[] = []
  const linkRegex = /<link[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0]

    const typeMatch = tag.match(/type=["']([^"']+)["']/i)
    if (!typeMatch) continue

    const type = typeMatch[1].toLowerCase()
    if (!FEED_CONTENT_TYPES.some((ct) => type.includes(ct))) continue

    const hrefMatch = tag.match(/href=["']([^"']+)["']/i)
    if (!hrefMatch) continue

    const titleMatch = tag.match(/title=["']([^"']+)["']/i)

    try {
      const feedUrl = new URL(hrefMatch[1], baseUrl).toString()
      validatePublicUrl(feedUrl)
      feeds.push({
        url: feedUrl,
        source: 'html-link',
        title: titleMatch?.[1],
      })
    } catch {
      // Invalid URL or private address, skip
    }
  }

  return feeds
}

async function probeCommonPaths(baseUrl: string): Promise<DiscoveredFeed[]> {
  const feeds: DiscoveredFeed[] = []
  const origin = new URL(baseUrl).origin

  const probes = COMMON_FEED_PATHS.map(async (path) => {
    const probeUrl = `${origin}${path}`
    const response = await fetchWithTimeout(probeUrl)

    if (!response || !response.ok) return null

    const contentType = response.headers.get('content-type') ?? ''
    const isXml = contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')

    if (!isXml) {
      const text = await response.text().catch(() => '')
      const looksLikeFeed = text.includes('<rss') || text.includes('<feed') || text.includes('<channel')
      if (!looksLikeFeed) return null
    }

    return { url: probeUrl, source: 'common-path' as const }
  })

  const results = await Promise.all(probes)
  for (const result of results) {
    if (result) feeds.push(result)
  }

  return feeds
}

export async function discoverRssFeeds(url: string): Promise<DiscoveredFeed[]> {
  validatePublicUrl(url)

  const seen = new Set<string>()
  const feeds: DiscoveredFeed[] = []

  const addFeed = (feed: DiscoveredFeed) => {
    if (!seen.has(feed.url)) {
      seen.add(feed.url)
      feeds.push(feed)
    }
  }

  // Step 1: Fetch page HTML and look for <link> tags
  const response = await fetchWithTimeout(url)
  if (response?.ok) {
    const html = await response.text().catch(() => '')
    const htmlFeeds = extractLinksFromHtml(html, url)
    for (const feed of htmlFeeds) {
      addFeed(feed)
    }
  }

  // Step 2: Probe common feed paths
  const commonFeeds = await probeCommonPaths(url)
  for (const feed of commonFeeds) {
    addFeed(feed)
  }

  return feeds
}
