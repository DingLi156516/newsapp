/**
 * lib/crawler/robots.ts — robots.txt compliance checker.
 *
 * Fetches and caches robots.txt per domain, checks if a URL is allowed.
 *
 * Fail-closed policy:
 * - Clean 404 → treat as "no robots.txt", allow crawling (standard behavior)
 * - 2xx with parseable body → respect the rules
 * - Network error, timeout, 5xx, or parse error → fail CLOSED (block)
 * - URL pointing at private/reserved network → block (SSRF guard)
 */

import robotsParser from 'robots-parser'
import { validatePublicUrl, validatePublicUrlWithDns } from '@/lib/rss/discover'

const DEFAULT_USER_AGENT = process.env.CRAWLER_USER_AGENT ?? 'AxiomNews/1.0 (News Crawler)'
const FETCH_TIMEOUT = 5_000

type RobotsStatus =
  | { readonly kind: 'parsed'; readonly parser: ReturnType<typeof robotsParser> }
  | { readonly kind: 'missing' } // clean 404 — allow crawling
  | { readonly kind: 'error' } // fetch/parse failed — block

const robotsCache = new Map<string, RobotsStatus>()

export function clearRobotsCache(): void {
  robotsCache.clear()
}

async function fetchRobotsTxt(origin: string): Promise<
  { kind: 'parsed'; body: string } | { kind: 'missing' } | { kind: 'error' }
> {
  try {
    // SSRF guard: origin must resolve to a public IP via DNS before we
    // even try to fetch its robots.txt
    await validatePublicUrlWithDns(origin)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const robotsUrl = `${origin}/robots.txt`
    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': DEFAULT_USER_AGENT },
    })

    clearTimeout(timeout)

    // SSRF guard: validate final URL after any redirect
    if (response.url && response.url !== robotsUrl) {
      await validatePublicUrlWithDns(response.url)
    }

    // Clean 404 means no robots.txt — allowed per RFC 9309
    if (response.status === 404) {
      return { kind: 'missing' }
    }

    // Any other non-2xx is an error (including 401, 403, 5xx)
    if (!response.ok) {
      return { kind: 'error' }
    }

    const body = await response.text()
    return { kind: 'parsed', body }
  } catch {
    return { kind: 'error' }
  }
}

async function getRobotsForOrigin(origin: string): Promise<RobotsStatus> {
  const cached = robotsCache.get(origin)
  if (cached) return cached

  const result = await fetchRobotsTxt(origin)
  let status: RobotsStatus

  if (result.kind === 'missing') {
    status = { kind: 'missing' }
  } else if (result.kind === 'error') {
    status = { kind: 'error' }
  } else {
    try {
      const parser = robotsParser(`${origin}/robots.txt`, result.body)
      status = { kind: 'parsed', parser }
    } catch {
      status = { kind: 'error' }
    }
  }

  robotsCache.set(origin, status)
  return status
}

export async function isAllowedByRobots(
  url: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<boolean> {
  // SSRF guard before robots fetch
  try {
    validatePublicUrl(url)
  } catch {
    return false
  }

  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return false
  }

  const status = await getRobotsForOrigin(origin)

  if (status.kind === 'missing') {
    // No robots.txt — standard practice is to allow
    return true
  }

  if (status.kind === 'error') {
    // Fail closed on errors — do NOT crawl when we can't verify rules
    return false
  }

  // robots-parser: isAllowed returns `undefined` when no matching rule,
  // `true` when allowed, `false` when disallowed. Treat `undefined` as allowed.
  return status.parser.isAllowed(url, userAgent) !== false
}
