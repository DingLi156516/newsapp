/**
 * lib/crawler/fetcher.ts — Web crawler SourceFetcher implementation.
 *
 * Discovers article URLs from a configured page, extracts content,
 * and produces ParsedFeedItem[] for the unified ingestion pipeline.
 */

import type { SourceFetcher, IngestionSource, FetchResult } from '@/lib/ingestion/types'
import type { ParsedFeedItem } from '@/lib/rss/parser'
import type { CrawlerConfig } from '@/lib/crawler/types'
import { crawlerConfigSchema } from '@/lib/crawler/validation'
import { discoverArticleUrls } from '@/lib/crawler/article-discovery'
import { extractArticle } from '@/lib/crawler/article-extractor'
import { clearRobotsCache, isAllowedByRobots } from '@/lib/crawler/robots'

const EXTRACT_CONCURRENCY = 3

async function processInBatches<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<readonly PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(fn))
    results.push(...batchResults)
  }

  return results
}

export const crawlerFetcher: SourceFetcher = {
  sourceType: 'crawler',

  async fetch(source: IngestionSource): Promise<FetchResult> {
    const parsed = crawlerConfigSchema.safeParse(source.config)
    if (!parsed.success) {
      return {
        items: [],
        error: {
          slug: source.slug,
          name: source.name,
          error: `Invalid crawler config: ${parsed.error.message}`,
          errorType: 'unknown',
        },
      }
    }

    const config: CrawlerConfig = parsed.data

    // Check robots.txt for the list page
    const listAllowed = await isAllowedByRobots(config.articleListUrl)
    if (!listAllowed) {
      return {
        items: [],
        error: {
          slug: source.slug,
          name: source.name,
          error: `robots.txt blocks ${config.articleListUrl}`,
          errorType: 'robots_blocked',
        },
      }
    }

    try {
      const articleUrls = await discoverArticleUrls(config)

      const results = await processInBatches(
        articleUrls,
        EXTRACT_CONCURRENCY,
        (url) => extractArticle(url, config)
      )

      const items: ParsedFeedItem[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const article = result.value
          items.push({
            title: article.title,
            url: article.url,
            description: article.description,
            content: article.content,
            imageUrl: article.imageUrl,
            publishedAt: article.publishedAt,
          })
        }
        // Silently skip failed extractions — partial success is expected
      }

      // Clear robots cache after each source to avoid stale data across runs
      clearRobotsCache()

      if (items.length === 0 && articleUrls.length > 0) {
        return {
          items: [],
          error: {
            slug: source.slug,
            name: source.name,
            error: `Discovered ${articleUrls.length} URLs but failed to extract any articles`,
            errorType: 'extraction_failed',
          },
        }
      }

      return { items, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      clearRobotsCache()

      return {
        items: [],
        error: {
          slug: source.slug,
          name: source.name,
          error: message,
          errorType: message.includes('HTTP 4') || message.includes('HTTP 5')
            ? 'http_error'
            : message.includes('abort') || message.includes('timeout')
              ? 'timeout'
              : 'extraction_failed',
        },
      }
    }
  },
}
