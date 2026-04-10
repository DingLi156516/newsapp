import anyAscii from 'any-ascii'

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
])

// AMP / mobile subdomain prefixes that should collapse to the parent host
// so different representations of the same article dedupe correctly.
const MOBILE_OR_AMP_PREFIXES = ['amp.', 'm.', 'mobile.']

function stripMobileOrAmpPrefix(host: string): string {
  for (const prefix of MOBILE_OR_AMP_PREFIXES) {
    if (host.startsWith(prefix)) {
      return host.slice(prefix.length)
    }
  }
  return host
}

function stripAmpPathSegment(pathname: string): string {
  // /amp/foo → /foo ; /foo/amp → /foo ; /foo/amp/bar → /foo/bar
  return pathname
    .replace(/^\/amp\//, '/')
    .replace(/\/amp(?=\/|$)/g, '')
    .replace(/\/{2,}/g, '/')
    || '/'
}

export function normalizeArticleUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = stripMobileOrAmpPrefix(parsed.hostname.toLowerCase())
    parsed.pathname = stripAmpPathSegment(parsed.pathname)

    // Drop empty params, lowercase keys, sort; tracking params were already
    // filtered by the TRACKING_PARAMS allowlist.
    const keptEntries = [...parsed.searchParams.entries()]
      .filter(([key, value]) => {
        if (TRACKING_PARAMS.has(key)) return false
        if (value === '' || value === undefined) return false
        return true
      })
      .map(([key, value]) => [key.toLowerCase(), value] as const)
      .sort(([a], [b]) => a.localeCompare(b))

    parsed.search = ''
    for (const [key, value] of keptEntries) {
      parsed.searchParams.append(key, value)
    }

    let normalized = parsed.toString()
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  } catch {
    return url.trim()
  }
}

export function createTitleFingerprint(title: string): string {
  return anyAscii(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
