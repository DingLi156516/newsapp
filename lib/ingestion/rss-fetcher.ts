/**
 * lib/ingestion/rss-fetcher.ts — RSS SourceFetcher adapter.
 *
 * Wraps the existing parseFeed function as a SourceFetcher implementation
 * for the unified ingestion pipeline.
 */

import type { SourceFetcher, IngestionSource, FetchResult } from '@/lib/ingestion/types'
import { parseFeed, categorizeFeedError } from '@/lib/rss/parser'
import { validatePublicUrl } from '@/lib/rss/discover'

export const rssFetcher: SourceFetcher = {
  sourceType: 'rss',

  async fetch(source: IngestionSource): Promise<FetchResult> {
    if (!source.rssUrl) {
      return {
        items: [],
        error: {
          slug: source.slug,
          name: source.name,
          error: 'No RSS URL configured',
          errorType: 'unknown',
        },
      }
    }

    try {
      validatePublicUrl(source.rssUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        items: [],
        error: {
          slug: source.slug,
          name: source.name,
          error: `URL validation failed for ${source.rssUrl}: ${message}`,
          errorType: 'unknown',
        },
      }
    }

    try {
      const items = await parseFeed(source.rssUrl)
      return { items, error: null }
    } catch (err) {
      const { type, message } = categorizeFeedError(err)
      return {
        items: [],
        error: { slug: source.slug, name: source.name, error: message, errorType: type },
      }
    }
  },
}
