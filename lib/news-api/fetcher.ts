/**
 * lib/news-api/fetcher.ts — News API SourceFetcher implementation.
 *
 * Routes to provider-specific clients (NewsAPI.org, GDELT)
 * with rate limiting and quota tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { SourceFetcher, IngestionSource, FetchResult } from '@/lib/ingestion/types'
import { newsApiConfigSchema } from '@/lib/news-api/validation'
import { tryAcquireQuota } from '@/lib/news-api/rate-limiter'
import { fetchNewsApi } from '@/lib/news-api/providers/newsapi'
import { fetchGdelt } from '@/lib/news-api/providers/gdelt'

/**
 * Factory that creates a news API fetcher bound to a Supabase client.
 * The client is needed because the rate limiter uses DB-backed atomic RPCs
 * to coordinate quota across processes (see migration 036).
 */
export function createNewsApiFetcher(client: SupabaseClient<Database>): SourceFetcher {
  return {
    sourceType: 'news_api',

    async fetch(source: IngestionSource): Promise<FetchResult> {
      const parsed = newsApiConfigSchema.safeParse(source.config)
      if (!parsed.success) {
        return {
          items: [],
          error: {
            slug: source.slug,
            name: source.name,
            error: `Invalid news API config: ${parsed.error.message}`,
            errorType: 'unknown',
          },
        }
      }

      const config = parsed.data

      // Atomic check + reserve a quota slot
      const quotaResult = await tryAcquireQuota(client, config.provider)
      if (!quotaResult.acquired) {
        return {
          items: [],
          error: {
            slug: source.slug,
            name: source.name,
            error: quotaResult.reason ?? 'Rate limited',
            errorType: 'rate_limited',
          },
        }
      }

      try {
        const items = config.provider === 'newsapi'
          ? await fetchNewsApi(config)
          : await fetchGdelt(config)

        return { items, error: null }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        const errorType = message.includes('authentication') || message.includes('401')
          ? 'api_auth_error' as const
          : message.includes('rate limit') || message.includes('429')
            ? 'rate_limited' as const
            : 'http_error' as const

        return {
          items: [],
          error: {
            slug: source.slug,
            name: source.name,
            error: message,
            errorType,
          },
        }
      }
    },
  }
}
