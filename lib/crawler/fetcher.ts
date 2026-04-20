/**
 * lib/crawler/fetcher.ts — Web crawler SourceFetcher implementation.
 *
 * Discovers article URLs from a configured page, extracts content,
 * and produces ParsedFeedItem[] for the unified ingestion pipeline.
 */

import type {
  SourceFetcher,
  IngestionSource,
  FetchResult,
  ExtractionFailure,
} from '@/lib/ingestion/types'
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

      // Wrap extraction so rejection reasons are paired with the URL they
      // came from. Otherwise Promise.allSettled loses the URL↔error mapping.
      const results = await processInBatches(
        articleUrls,
        EXTRACT_CONCURRENCY,
        async (url) => {
          try {
            return { url, article: await extractArticle(url, config), error: null as Error | null }
          } catch (err) {
            return { url, article: null, error: err instanceof Error ? err : new Error(String(err)) }
          }
        }
      )

      const items: ParsedFeedItem[] = []
      const failedUrls: ExtractionFailure[] = []

      for (const result of results) {
        if (result.status === 'rejected') {
          // Shouldn't happen with the try/catch above, but be defensive.
          continue
        }
        const { url, article, error } = result.value
        if (article) {
          items.push({
            title: article.title,
            url: article.url,
            description: article.description,
            content: article.content,
            imageUrl: article.imageUrl,
            publishedAt: article.publishedAt,
            categories: null,
          })
          continue
        }
        // Extraction failed or returned null: capture the failure so the
        // orchestrator can persist it to pipeline_extraction_failures.
        const message = error?.message ?? 'extraction returned null'
        const kind: ExtractionFailure['kind'] = message.includes('robots.txt')
          ? 'robots_blocked'
          : message.includes('SSRF') || message.includes('private')
            ? 'ssrf_blocked'
            : message.includes('HTTP')
              ? 'fetch_error'
              : 'extraction_failed'
        failedUrls.push({ url, kind, message })
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
          failedUrls,
        }
      }

      return { items, error: null, failedUrls }
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
