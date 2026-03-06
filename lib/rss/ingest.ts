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
import { parseFeed, type ParsedFeedItem } from '@/lib/rss/parser'
import { filterNewArticles } from '@/lib/rss/dedup'

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
}

const INSERT_BATCH_SIZE = 50
const FETCH_CONCURRENCY = 5

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
    const items = await parseFeed(feed.rssUrl)
    return { items, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      items: [],
      error: { slug: feed.slug, name: feed.name, error: message },
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
      errors.push({
        slug: feed.slug,
        name: feed.name,
        error: String(result.reason),
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
  const newUrlSet = new Set(newItems.map((item) => item.url))

  const seen = new Set<string>()
  const inserts = allItems
    .filter((entry) => newUrlSet.has(entry.item.url))
    .filter((entry) => {
      if (seen.has(entry.item.url)) return false
      seen.add(entry.item.url)
      return true
    })
    .map((entry) => toArticleInsert(entry.item, entry.sourceId))

  let insertedCount = 0

  for (let i = 0; i < inserts.length; i += INSERT_BATCH_SIZE) {
    const batch = inserts.slice(i, i + INSERT_BATCH_SIZE)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any)
      .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })

    if (error) {
      throw new Error(`Article insert failed: ${error.message}`)
    }

    insertedCount += batch.length
  }

  return {
    totalFeeds: feeds.length,
    successfulFeeds: feeds.length - errors.length,
    failedFeeds: errors.length,
    newArticles: insertedCount,
    errors,
  }
}
