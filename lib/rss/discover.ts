/**
 * lib/rss/discover.ts — RSS feed auto-discovery.
 *
 * Given a website URL, discovers RSS/Atom feeds by:
 * 1. Parsing HTML <link> tags from the page
 * 2. Probing common feed paths (/feed, /rss, etc.)
 */

import { lookup } from 'node:dns/promises'

const PRIVATE_IP_RANGES = [
  /^127\./,                    // 127.0.0.0/8
  /^10\./,                     // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,               // 192.168.0.0/16
  /^169\.254\./,               // 169.254.0.0/16 (link-local / AWS IMDS)
  /^0\./,                      // 0.0.0.0/8
]

const BLOCKED_HOSTNAMES = new Set(['localhost', '[::1]', '0.0.0.0', '[::]'])

const BLOCKED_IPV6_PREFIXES = [
  /^::$/,           // unspecified
  /^::1$/,          // loopback (without brackets)
  /^f[cd]/i,        // fc00::/7 unique local (fc.. and fd..)
  /^fe[89ab]/i,     // fe80::/10 link-local
]

/**
 * Extract the embedded IPv4 from an IPv4-mapped IPv6 address.
 * Node normalizes `::ffff:127.0.0.1` to `::ffff:7f00:1`, so we parse
 * the two trailing hex groups back to dotted-decimal.
 */
function extractMappedIPv4(bare: string): string | null {
  const match = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!match) return null
  const hi = parseInt(match[1], 16)
  const lo = parseInt(match[2], 16)
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
}

export function validatePublicUrl(url: string): void {
  const parsed = new URL(url)

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL targets a private or reserved network address')
  }

  const hostname = parsed.hostname

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('URL targets a private or reserved network address')
  }

  if (PRIVATE_IP_RANGES.some((re) => re.test(hostname))) {
    throw new Error('URL targets a private or reserved network address')
  }

  const bare = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  if (BLOCKED_IPV6_PREFIXES.some((re) => re.test(bare))) {
    throw new Error('URL targets a private or reserved network address')
  }

  const mappedIPv4 = extractMappedIPv4(bare)
  if (mappedIPv4 && PRIVATE_IP_RANGES.some((re) => re.test(mappedIPv4))) {
    throw new Error('URL targets a private or reserved network address')
  }
}

/**
 * Checks if a resolved IP address (v4 or v6) targets a private/reserved range.
 * Used by validatePublicUrlWithDns after DNS resolution.
 */
function isPrivateAddress(address: string): boolean {
  if (BLOCKED_HOSTNAMES.has(address)) return true
  if (PRIVATE_IP_RANGES.some((re) => re.test(address))) return true
  if (BLOCKED_IPV6_PREFIXES.some((re) => re.test(address))) return true

  const mappedIPv4 = extractMappedIPv4(address)
  if (mappedIPv4 && PRIVATE_IP_RANGES.some((re) => re.test(mappedIPv4))) return true

  return false
}

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
