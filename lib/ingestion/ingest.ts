/**
 * lib/ingestion/ingest.ts — Unified multi-source ingestion orchestrator.
 *
 * Replaces direct ingestFeeds call. Fetches from all source types
 * (RSS, crawler, news API) using the fetcher registry, then runs the
 * shared dedup → normalize → insert → health update pipeline.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type {
  IngestionSource,
  FeedError,
  FetchResult,
  IngestionResult,
  TypeBreakdown,
  SourceType,
  ParsedFeedItem,
} from '@/lib/ingestion/types'
import { getActiveSources, groupByType } from '@/lib/ingestion/source-registry'
import { getFetcher, hasFetcher, registerFetcher } from '@/lib/ingestion/fetcher-registry'
import { rssFetcher } from '@/lib/ingestion/rss-fetcher'
import { crawlerFetcher } from '@/lib/crawler/fetcher'
import { createNewsApiFetcher } from '@/lib/news-api/fetcher'
import {
  toArticleInsert,
  capArticlesPerSource,
  deduplicateItems,
  batchInsertArticles,
  updateSourceHealth,
  persistExtractionFailures,
} from '@/lib/ingestion/pipeline-helpers'
import { noopStageEmitter, safeEmit, type StageEventEmitter } from '@/lib/pipeline/stage-events'

const CONCURRENCY_DEFAULTS: Record<SourceType, number> = {
  rss: 5,
  crawler: 2,
  news_api: 1,
}

function getConcurrency(sourceType: SourceType): number {
  const envKey = `PIPELINE_${sourceType.toUpperCase()}_CONCURRENCY`
  const envVal = process.env[envKey]
  return envVal ? Number(envVal) : CONCURRENCY_DEFAULTS[sourceType]
}

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

/**
 * Registers all source fetchers. The news API fetcher is created per-client
 * because it needs access to Supabase for DB-backed atomic quota checks.
 * RSS and crawler fetchers are stateless singletons.
 */
function registerAllFetchers(client: SupabaseClient<Database>): void {
  registerFetcher(rssFetcher)
  registerFetcher(crawlerFetcher)
  registerFetcher(createNewsApiFetcher(client))
}

interface SourceFetchOutcome {
  readonly source: IngestionSource
  readonly items: readonly ParsedFeedItem[]
  readonly error: FeedError | null
}

async function fetchSource(
  source: IngestionSource,
  emitter: StageEventEmitter
): Promise<FetchResult> {
  const fetcher = getFetcher(source.sourceType)
  const startedAt = Date.now()
  await safeEmit(emitter, {
    stage: 'ingest',
    level: 'info',
    eventType: 'source_fetch_start',
    sourceId: source.sourceId,
    provider: source.sourceType,
    payload: { slug: source.slug, name: source.name },
  })
  try {
    const result = await fetcher.fetch(source)
    // Fetchers report normal failures by returning result.error rather than
    // throwing (RSS parse errors, robots blocks, rate limits, etc.). Emit
    // those at warn so they surface in the Top Errors panel; only true
    // successes go to info.
    await safeEmit(emitter, {
      stage: 'ingest',
      level: result.error ? 'warn' : 'info',
      eventType: 'source_fetch_complete',
      sourceId: source.sourceId,
      provider: source.sourceType,
      durationMs: Date.now() - startedAt,
      payload: {
        slug: source.slug,
        items: result.items.length,
        error: result.error?.error ?? null,
        errorType: result.error?.errorType ?? null,
      },
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await safeEmit(emitter, {
      stage: 'ingest',
      level: 'warn',
      eventType: 'source_fetch_complete',
      sourceId: source.sourceId,
      provider: source.sourceType,
      durationMs: Date.now() - startedAt,
      payload: { slug: source.slug, error: message },
    })
    throw err
  }
}

function createEmptyBreakdown(): TypeBreakdown {
  return { total: 0, successful: 0, failed: 0, articles: 0 }
}

export async function ingestAllSources(
  client: SupabaseClient<Database>,
  emitter: StageEventEmitter = noopStageEmitter
): Promise<IngestionResult> {
  registerAllFetchers(client)

  const allSources = await getActiveSources(client)
  const grouped = groupByType(allSources)

  const outcomes: SourceFetchOutcome[] = []
  const errors: FeedError[] = []
  const byType: Record<SourceType, TypeBreakdown> = {
    rss: createEmptyBreakdown(),
    crawler: createEmptyBreakdown(),
    news_api: createEmptyBreakdown(),
  }

  // Fetch sources grouped by type with per-type concurrency
  for (const [sourceType, sources] of grouped) {
    if (!hasFetcher(sourceType)) {
      for (const source of sources) {
        const err: FeedError = {
          slug: source.slug,
          name: source.name,
          error: `No fetcher registered for source type: ${sourceType}`,
          errorType: 'unknown',
        }
        errors.push(err)
        outcomes.push({ source, items: [], error: err })
      }
      continue
    }

    const concurrency = getConcurrency(sourceType)
    const results = await processInBatches(sources, concurrency, (source) =>
      fetchSource(source, emitter)
    )

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const source = sources[i]

      if (result.status === 'rejected') {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
        const err: FeedError = {
          slug: source.slug,
          name: source.name,
          error: message,
          errorType: 'unknown',
        }
        errors.push(err)
        outcomes.push({ source, items: [], error: err })
      } else {
        const { items, error, failedUrls } = result.value
        if (error) errors.push(error)
        outcomes.push({ source, items, error })
        // Persist per-item extraction failures so operators can see what
        // was dropped instead of them vanishing silently.
        if (failedUrls && failedUrls.length > 0) {
          await persistExtractionFailures(client, source.sourceId, failedUrls)
        }
      }
    }
  }

  // Build allItems from outcomes
  const allItems: { readonly item: ParsedFeedItem; readonly sourceId: string }[] = []
  for (const outcome of outcomes) {
    for (const item of outcome.items) {
      allItems.push({ item, sourceId: outcome.source.sourceId })
    }
  }

  // Dedup against DB + within batch
  const dedupedItems = await deduplicateItems(client, allItems)

  // Per-source cap
  const cappedItems = capArticlesPerSource(dedupedItems)

  // Map to DB inserts
  const inserts = cappedItems.map((entry) => toArticleInsert(entry.item, entry.sourceId))

  // Batch insert — returns actual inserted counts per source (not attempted)
  const { totalInserted, insertedBySource } = await batchInsertArticles(client, inserts)

  // Update source health for each source using ACTUAL inserted row counts
  for (const outcome of outcomes) {
    const articlesForSource = insertedBySource.get(outcome.source.sourceId) ?? 0
    await updateSourceHealth(client, outcome.source.sourceId, {
      error: outcome.error,
      articlesInserted: articlesForSource,
    })
  }

  // Compute per-type breakdowns using ACTUAL inserted row counts
  for (const outcome of outcomes) {
    const breakdown = byType[outcome.source.sourceType]
    const articlesForSource = insertedBySource.get(outcome.source.sourceId) ?? 0

    byType[outcome.source.sourceType] = {
      total: breakdown.total + 1,
      successful: breakdown.successful + (outcome.error ? 0 : 1),
      failed: breakdown.failed + (outcome.error ? 1 : 0),
      articles: breakdown.articles + articlesForSource,
    }
  }

  return {
    totalSources: allSources.length,
    successfulSources: allSources.length - errors.length,
    failedSources: errors.length,
    newArticles: totalInserted,
    errors,
    byType,
  }
}
