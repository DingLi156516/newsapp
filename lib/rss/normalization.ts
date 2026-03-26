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

export function normalizeArticleUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase()

    const keptEntries = [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.has(key))
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
