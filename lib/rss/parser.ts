/**
 * lib/rss/parser.ts — RSS/Atom feed parser.
 *
 * Wraps the rss-parser library with timeout handling and normalizes
 * feed items into a consistent shape for ingestion.
 */

import RssParser from 'rss-parser'

export interface ParsedFeedItem {
  readonly title: string
  readonly url: string
  readonly description: string | null
  readonly content: string | null
  readonly imageUrl: string | null
  // Null when the upstream feed either omitted pubDate or gave us an
  // unparseable value. The ingestion layer records these as
  // `published_at_estimated = true` rather than fabricating a timestamp.
  readonly publishedAt: string | null
  // RSS <category> tag values — feeds like TechCrunch/NYT tag items with
  // section labels ("Technology", "Politics") that feed the thin-cluster
  // topic classifier's first signal. Null when absent or empty.
  readonly categories: readonly string[] | null
}

const parser = new RssParser({
  timeout: 10_000,
  headers: {
    'User-Agent': 'AxiomNews/1.0 (RSS Aggregator)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  },
  maxRedirects: 3,
})

function extractImageUrl(item: RssParser.Item): string | null {
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url
  }

  const mediaContent = (item as Record<string, unknown>)['media:content'] as
    | { $?: { url?: string; medium?: string } }
    | undefined

  if (mediaContent?.$?.url && mediaContent.$.medium === 'image') {
    return mediaContent.$.url
  }

  return null
}

function normalizeCategories(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw)) return null

  const normalized: string[] = []
  for (const entry of raw) {
    // rss-parser passes attributed categories as objects:
    //   <category domain="section">Politics</category>  →  { _: 'Politics', $: { domain: 'section' } }
    // Plain <category>Politics</category> is delivered as a string. Read
    // the text content from either shape; skip anything unrecognisable.
    let text: string | null = null
    if (typeof entry === 'string') {
      text = entry
    } else if (entry && typeof entry === 'object') {
      const inner = (entry as { _?: unknown })._
      if (typeof inner === 'string') {
        text = inner
      }
    }

    if (text === null) continue
    const trimmed = text.trim()
    if (trimmed.length === 0) continue
    normalized.push(trimmed)
  }

  return normalized.length > 0 ? normalized : null
}

function normalizeDate(dateString: string | undefined): string | null {
  if (!dateString) {
    return null
  }

  const parsed = new Date(dateString)
  if (isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

export async function parseFeed(url: string): Promise<readonly ParsedFeedItem[]> {
  const feed = await parser.parseURL(url)

  return (feed.items ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title!.trim(),
      url: item.link!.trim(),
      description: item.contentSnippet?.trim() ?? item.summary?.trim() ?? null,
      content: item.content?.trim() ?? null,
      imageUrl: extractImageUrl(item),
      publishedAt: normalizeDate(item.isoDate ?? item.pubDate),
      categories: normalizeCategories((item as { categories?: unknown }).categories),
    }))
}

export type FeedErrorType =
  | 'timeout'
  | 'http_error'
  | 'parse_error'
  | 'dns_error'
  | 'robots_blocked'
  | 'extraction_failed'
  | 'rate_limited'
  | 'api_auth_error'
  | 'unknown'

export function categorizeFeedError(err: unknown): { type: FeedErrorType; message: string } {
  const message = err instanceof Error ? err.message : String(err)

  // Timeout errors
  if (
    message.includes('ETIMEDOUT') ||
    message.includes('ESOCKETTIMEDOUT') ||
    message.includes('AbortError') ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return { type: 'timeout', message }
  }

  // DNS errors
  if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN')) {
    return { type: 'dns_error', message }
  }

  // HTTP errors
  if (/\b(403|404|429|5\d{2})\b/.test(message) || message.includes('Status code')) {
    return { type: 'http_error', message }
  }

  // Parse errors
  if (
    message.includes('Non-whitespace before first tag') ||
    message.includes('Unexpected close tag') ||
    message.includes('Invalid XML') ||
    message.includes('not well-formed') ||
    message.includes('Unable to parse XML') ||
    message.includes('Attribute without value') ||
    message.includes('Unquoted attribute value') ||
    message.includes('not recognized as RSS')
  ) {
    return { type: 'parse_error', message }
  }

  return { type: 'unknown', message }
}
