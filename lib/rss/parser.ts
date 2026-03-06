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
  readonly publishedAt: string
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

function normalizeDate(dateString: string | undefined): string {
  if (!dateString) {
    return new Date().toISOString()
  }

  const parsed = new Date(dateString)
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString()
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
    }))
}
