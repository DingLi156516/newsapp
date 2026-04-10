/**
 * lib/ingestion/pipeline-helpers.ts — Shared helpers for the ingestion pipeline.
 *
 * Extracted from lib/rss/ingest.ts for use by all source types.
 * Handles article insert mapping, per-source capping, batch insert, and health updates.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbArticleInsert, FetchStatus } from '@/lib/supabase/types'
import type { ParsedFeedItem, FeedError, ExtractionFailure } from '@/lib/ingestion/types'
import { normalizeArticleUrl, createTitleFingerprint } from '@/lib/rss/normalization'
import { filterNewArticles } from '@/lib/rss/dedup'

const INSERT_BATCH_SIZE = 50
const DEFAULT_MAX_PER_SOURCE = 30

export function toArticleInsert(
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
    published_at_estimated: item.publishedAt === null,
  }
}

export function getCanonicalIdentity(url: string): string {
  return normalizeArticleUrl(url)
}

export function capArticlesPerSource(
  items: readonly { readonly item: ParsedFeedItem; readonly sourceId: string }[],
  maxPerSource: number = Number(process.env.PIPELINE_INGEST_MAX_PER_SOURCE ?? DEFAULT_MAX_PER_SOURCE)
): readonly { readonly item: ParsedFeedItem; readonly sourceId: string }[] {
  const bySource = new Map<string, { readonly item: ParsedFeedItem; readonly sourceId: string }[]>()

  for (const entry of items) {
    const existing = bySource.get(entry.sourceId) ?? []
    bySource.set(entry.sourceId, [...existing, entry])
  }

  const capped: { readonly item: ParsedFeedItem; readonly sourceId: string }[] = []
  for (const entries of bySource.values()) {
    const sorted = [...entries].sort((a, b) => {
      const aDate = a.item.publishedAt ?? ''
      const bDate = b.item.publishedAt ?? ''
      return bDate.localeCompare(aDate)
    })
    capped.push(...sorted.slice(0, maxPerSource))
  }

  return capped
}

export async function deduplicateItems(
  client: SupabaseClient<Database>,
  allItems: readonly { readonly item: ParsedFeedItem; readonly sourceId: string }[]
): Promise<readonly { readonly item: ParsedFeedItem; readonly sourceId: string }[]> {
  // Pass source IDs through so filterNewArticles can also dedup by
  // (title_fingerprint, source_id) — catches same-source republishes with
  // a new URL that would otherwise slip past the canonical-URL check.
  const newItems = await filterNewArticles(client, allItems)
  const newCanonicalSet = new Set(
    newItems.map((item) => getCanonicalIdentity(item.url))
  )

  const seenCanonical = new Set<string>()
  return allItems
    .filter((entry) => newCanonicalSet.has(getCanonicalIdentity(entry.item.url)))
    .filter((entry) => {
      const canonical = getCanonicalIdentity(entry.item.url)
      if (seenCanonical.has(canonical)) return false
      seenCanonical.add(canonical)
      return true
    })
}

function formatArticleInsertError(message: string): string {
  if (message.includes('articles_url_key')) {
    return `${message} (legacy raw-url unique constraint still exists; apply migration 011_articles_canonical_url_cutover.sql)`
  }
  return message
}

export interface BatchInsertResult {
  readonly totalInserted: number
  readonly insertedBySource: ReadonlyMap<string, number>
}

/**
 * Inserts articles in batches with upsert+ignoreDuplicates, returning the
 * actual number of rows inserted (not attempted). This matters because
 * canonical-URL conflicts mean upsert may skip rows silently; counting
 * attempted inserts inflates source-health and ingest metrics under concurrent runs.
 */
export async function batchInsertArticles(
  client: SupabaseClient<Database>,
  inserts: readonly DbArticleInsert[],
  batchSize: number = INSERT_BATCH_SIZE
): Promise<BatchInsertResult> {
  const insertedBySource = new Map<string, number>()
  let totalInserted = 0

  for (let i = 0; i < inserts.length; i += batchSize) {
    const batch = inserts.slice(i, i + batchSize)

    // Select inserted rows so we can count actual inserts (not attempted).
    // With ignoreDuplicates: true, only non-conflicting rows are returned.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.from('articles') as any)
      .upsert(batch, { onConflict: 'canonical_url', ignoreDuplicates: true })
      .select('id, source_id')

    if (error) {
      throw new Error(`Article insert failed: ${formatArticleInsertError(error.message)}`)
    }

    const rows = (data ?? []) as Array<{ id: string; source_id: string }>
    totalInserted += rows.length

    for (const row of rows) {
      insertedBySource.set(row.source_id, (insertedBySource.get(row.source_id) ?? 0) + 1)
    }
  }

  return { totalInserted, insertedBySource }
}

/**
 * Persist per-item extraction failures to `pipeline_extraction_failures`
 * (migration 040) so operators can see what the crawler dropped instead of
 * the failures being silently swallowed. Best-effort: on DB error we log
 * and move on so a failing audit table never blocks ingestion.
 */
export async function persistExtractionFailures(
  client: SupabaseClient<Database>,
  sourceId: string,
  failures: readonly ExtractionFailure[]
): Promise<void> {
  if (failures.length === 0) return

  const rows = failures.map((f) => ({
    source_id: sourceId,
    url: f.url,
    failure_kind: f.kind,
    error_message: f.message,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('pipeline_extraction_failures') as any).insert(rows)
  if (error) {
    console.warn(
      `[ingest] failed to persist ${failures.length} extraction failures for source ${sourceId}: ${error.message}`
    )
  }
}

/**
 * Atomically updates source health counters via DB-side RPC functions
 * (migration 036). Replaces the racy read-modify-write pattern so concurrent
 * ingest runs do not lose counter updates.
 */
export async function updateSourceHealth(
  client: SupabaseClient<Database>,
  sourceId: string,
  result: { error: FeedError | null; articlesInserted: number }
): Promise<void> {
  if (result.error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any).rpc('increment_source_failure', {
      p_source_id: sourceId,
      p_status: result.error.errorType as FetchStatus,
      p_error: result.error.error,
    })

    if (error) {
      throw new Error(`Failed to update source health (failure): ${error.message}`)
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any).rpc('increment_source_success', {
      p_source_id: sourceId,
      p_articles_added: result.articlesInserted,
    })

    if (error) {
      throw new Error(`Failed to update source health (success): ${error.message}`)
    }
  }
}
