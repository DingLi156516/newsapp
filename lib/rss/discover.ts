/**
 * lib/rss/discover.ts — RSS feed auto-discovery.
 *
 * Given a website URL, discovers RSS/Atom feeds by:
 * 1. Parsing HTML <link> tags from the page
 * 2. Probing common feed paths (/feed, /rss, etc.)
 */

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
