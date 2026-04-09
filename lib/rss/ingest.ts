/**
 * lib/rss/ingest.ts — RSS ingestion orchestrator.
 *
 * Fetches RSS feeds for all active sources, deduplicates against existing
 * articles, and inserts new articles into the database.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { DbArticleInsert } from '@/lib/supabase/types'
import { getActiveFeeds, type FeedEntry } from '@/lib/rss/feed-registry'
import { parseFeed, categorizeFeedError, type ParsedFeedItem, type FeedErrorType } from '@/lib/rss/parser'
import { filterNewArticles } from '@/lib/rss/dedup'
import { createTitleFingerprint, normalizeArticleUrl } from '@/lib/rss/normalization'
import { validatePublicUrl } from '@/lib/rss/discover'

export interface IngestionResult {
  readonly totalFeeds: number
  readonly successfulFeeds: number
  readonly failedFeeds: number
  readonly newArticles: number
  readonly errors: readonly FeedError[]
}

export interface FeedError {
  readonly slug: string
  readonly name: string
  readonly error: string
  readonly errorType: FeedErrorType
}

const INSERT_BATCH_SIZE = 50
const FETCH_CONCURRENCY = 5
const INGEST_MAX_ARTICLES_PER_SOURCE = Number(
  process.env.PIPELINE_INGEST_MAX_PER_SOURCE ?? 30
)

function getCanonicalIdentity(url: string): string {
  return normalizeArticleUrl(url)
}

function formatArticleInsertError(message: string): string {
  if (message.includes('articles_url_key')) {
    return `${message} (legacy raw-url unique constraint still exists; apply migration 011_articles_canonical_url_cutover.sql)`
  }

  return message
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

async function fetchFeed(
  feed: FeedEntry
): Promise<{ items: readonly ParsedFeedItem[]; error: FeedError | null }> {
  try {
    validatePublicUrl(feed.rssUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      items: [],
      error: {
        slug: feed.slug,
        name: feed.name,
        error: `URL validation failed for ${feed.rssUrl}: ${message}`,
        errorType: 'unknown',
      },
    }
  }

  try {
    const items = await parseFeed(feed.rssUrl)
    return { items, error: null }
  } catch (err) {
    const { type, message } = categorizeFeedError(err)
    return {
      items: [],
      error: { slug: feed.slug, name: feed.name, error: message, errorType: type },
    }
  }
}

function toArticleInsert(
  item: ParsedFeedItem,
  sourceId: string
): DbArticleInsert {
  return {
    source_id: sourceId,
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
    canonical_url: normalizeArticleUrl(item.url),
    title_fingerprint: createTitleFingerprint(item.title),
    image_url: item.imageUrl,
    published_at: item.publishedAt,
  }
}

export async function ingestFeeds(
  client: SupabaseClient<Database>
): Promise<IngestionResult> {
  const feeds = await getActiveFeeds(client)

  const feedResults = await processInBatches(
    feeds,
    FETCH_CONCURRENCY,
    fetchFeed
  )

  const errors: FeedError[] = []
  const allItems: { item: ParsedFeedItem; sourceId: string }[] = []

  for (let i = 0; i < feedResults.length; i++) {
    const result = feedResults[i]
    const feed = feeds[i]

    if (result.status === 'rejected') {
      const { type, message } = categorizeFeedError(result.reason)
      errors.push({
        slug: feed.slug,
        name: feed.name,
        error: message,
        errorType: type,
      })
      continue
    }

    const { items, error } = result.value
    if (error) {
      errors.push(error)
    }

    for (const item of items) {
      allItems.push({ item: item, sourceId: feed.sourceId })
    }
  }

  const parsedItems = allItems.map((entry) => entry.item)
  const newItems = await filterNewArticles(client, parsedItems)
  const newCanonicalSet = new Set(newItems.map((item) => getCanonicalIdentity(item.url)))

  const seenCanonical = new Set<string>()
  const dedupedItems = allItems
    .filter((entry) => newCanonicalSet.has(getCanonicalIdentity(entry.item.url)))
    .filter((entry) => {
      const canonicalIdentity = getCanonicalIdentity(entry.item.url)
      if (seenCanonical.has(canonicalIdentity)) return false
      seenCanonical.add(canonicalIdentity)
      return true
    })

  // Per-source cap: keep only the newest N articles per source
  const bySource = new Map<string, typeof dedupedItems>()
  for (const entry of dedupedItems) {
    const existing = bySource.get(entry.sourceId) ?? []
    bySource.set(entry.sourceId, [...existing, entry])
  }

  const cappedItems: typeof dedupedItems = []
  for (const entries of bySource.values()) {
    const sorted = [...entries].sort((a, b) => {
      const aDate = a.item.publishedAt ?? ''
      const bDate = b.item.publishedAt ?? ''
      return bDate.localeCompare(aDate)
    })
    cappedItems.push(...sorted.slice(0, INGEST_MAX_ARTICLES_PER_SOURCE))
  }

  const inserts = cappedItems.map((entry) => toArticleInsert(entry.item, entry.sourceId))

  let insertedCount = 0

  for (let i = 0; i < inserts.length; i += INSERT_BATCH_SIZE) {
    const batch = inserts.slice(i, i + INSERT_BATCH_SIZE)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any)
      .upsert(batch, { onConflict: 'canonical_url', ignoreDuplicates: true })

    if (error) {
      throw new Error(`Article insert failed: ${formatArticleInsertError(error.message)}`)
    }

    insertedCount += batch.length
  }

  // Update source health for each feed
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i]
    const result = feedResults[i]

    if (result.status === 'rejected') {
      const { type, message } = categorizeFeedError(result.reason)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sourceData } = await (client.from('sources') as any)
        .select('consecutive_failures')
        .eq('id', feed.sourceId)
        .single()

      const currentFailures = (sourceData?.consecutive_failures as number) ?? 0

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from('sources') as any)
        .update({
          last_fetch_at: new Date().toISOString(),
          last_fetch_status: type,
          last_fetch_error: message,
          consecutive_failures: currentFailures + 1,
        })
        .eq('id', feed.sourceId)
      continue
    }

    const { error: feedError } = result.value
    if (feedError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sourceData } = await (client.from('sources') as any)
        .select('consecutive_failures')
        .eq('id', feed.sourceId)
        .single()

      const currentFailures = (sourceData?.consecutive_failures as number) ?? 0

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from('sources') as any)
        .update({
          last_fetch_at: new Date().toISOString(),
          last_fetch_status: feedError.errorType,
          last_fetch_error: feedError.error,
          consecutive_failures: currentFailures + 1,
        })
        .eq('id', feed.sourceId)
    } else {
      const articlesForSource = inserts.filter((a) => a.source_id === feed.sourceId).length

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sourceData } = await (client.from('sources') as any)
        .select('total_articles_ingested')
        .eq('id', feed.sourceId)
        .single()

      const currentTotal = (sourceData?.total_articles_ingested as number) ?? 0

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from('sources') as any)
        .update({
          last_fetch_at: new Date().toISOString(),
          last_fetch_status: 'success',
          last_fetch_error: null,
          consecutive_failures: 0,
          total_articles_ingested: currentTotal + articlesForSource,
        })
        .eq('id', feed.sourceId)
    }
  }

  return {
    totalFeeds: feeds.length,
    successfulFeeds: feeds.length - errors.length,
    failedFeeds: errors.length,
    newArticles: insertedCount,
    errors,
  }
}
