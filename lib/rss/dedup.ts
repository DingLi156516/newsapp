/**
 * lib/rss/dedup.ts — Dedup for ingestion pipeline.
 *
 * Checks if an article is a duplicate against the existing DB:
 *   1. canonical_url match — same URL (including AMP/mobile variants after
 *      normalization)
 *   2. (title_fingerprint, source_id) match — same source re-published the
 *      same headline at a new URL (common with editorial updates)
 *
 * Cross-source title-fingerprint matches are NOT treated as duplicates —
 * that case is the clustering stage's job.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ParsedFeedItem } from '@/lib/rss/parser'
import { normalizeArticleUrl, createTitleFingerprint } from '@/lib/rss/normalization'

const BATCH_SIZE = 20

export interface DedupInput {
  readonly item: ParsedFeedItem
  readonly sourceId?: string
}

/**
 * Filter out items that already exist in the DB, based on canonical URL OR
 * on `(title_fingerprint, source_id)` for same-source republishes.
 *
 * Accepts either a plain list of `ParsedFeedItem` (URL-only dedup) or a
 * richer list of `{ item, sourceId }` pairs to enable title-fingerprint
 * dedup scoped to the same source.
 */
export async function filterNewArticles(
  client: SupabaseClient<Database>,
  input: readonly ParsedFeedItem[] | readonly DedupInput[]
): Promise<readonly ParsedFeedItem[]> {
  if (input.length === 0) {
    return []
  }

  // Normalize to richer shape so the rest of the function doesn't branch.
  const entries: DedupInput[] = 'item' in (input[0] as object)
    ? (input as readonly DedupInput[]).map((e) => ({ item: e.item, sourceId: e.sourceId }))
    : (input as readonly ParsedFeedItem[]).map((item) => ({ item }))

  const items = entries.map((e) => e.item)
  const canonicalUrls = items.map((item) => normalizeArticleUrl(item.url))
  const rawUrls = items.map((item) => item.url)

  // source_id → set of title fingerprints we need to look up
  const fingerprintsBySource = new Map<string, Set<string>>()
  for (const entry of entries) {
    if (!entry.sourceId) continue
    const fp = createTitleFingerprint(entry.item.title)
    if (!fp) continue
    const set = fingerprintsBySource.get(entry.sourceId) ?? new Set<string>()
    set.add(fp)
    fingerprintsBySource.set(entry.sourceId, set)
  }

  const existingCanonicalUrls = new Set<string>()
  const existingRawUrls = new Set<string>()
  // Map of sourceId → set of known title fingerprints in the DB for that source.
  const existingFingerprintsBySource = new Map<string, Set<string>>()

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const canonicalBatch = canonicalUrls.slice(i, i + BATCH_SIZE)
    const rawBatch = rawUrls.slice(i, i + BATCH_SIZE)

    const { data: canonicalData, error: canonicalError } = await client
      .from('articles')
      .select('canonical_url')
      .in('canonical_url', canonicalBatch)
      .returns<Array<{ canonical_url: string | null }>>()

    if (canonicalError) {
      throw new Error(
        `Dedup query failed (batch ${i / BATCH_SIZE + 1}, canonical urls): ${canonicalError.message}`
      )
    }

    const { data: rawData, error: rawError } = await client
      .from('articles')
      .select('url')
      .in('url', rawBatch)
      .returns<Array<{ url: string }>>()

    if (rawError) {
      throw new Error(
        `Dedup query failed (batch ${i / BATCH_SIZE + 1}, raw urls): ${rawError.message}`
      )
    }

    for (const row of canonicalData ?? []) {
      if (row.canonical_url) {
        existingCanonicalUrls.add(row.canonical_url)
      }
    }

    for (const row of rawData ?? []) {
      existingRawUrls.add(row.url)
    }
  }

  // Title-fingerprint dedup (scoped to same source). One query per source
  // keeps the predicate simple and indexable via idx_articles_title_fp_source.
  for (const [sourceId, fingerprints] of fingerprintsBySource) {
    const fpList = [...fingerprints]
    const existingSet = new Set<string>()

    for (let i = 0; i < fpList.length; i += BATCH_SIZE) {
      const batch = fpList.slice(i, i + BATCH_SIZE)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (client.from('articles') as any)
        .select('title_fingerprint')
        .eq('source_id', sourceId)
        .in('title_fingerprint', batch)

      if (error) {
        throw new Error(
          `Dedup query failed (source ${sourceId} fingerprints): ${error.message}`
        )
      }

      for (const row of (data ?? []) as Array<{ title_fingerprint: string | null }>) {
        if (row.title_fingerprint) existingSet.add(row.title_fingerprint)
      }
    }

    existingFingerprintsBySource.set(sourceId, existingSet)
  }

  return entries
    .filter((entry) => {
      const canonicalUrl = normalizeArticleUrl(entry.item.url)
      if (existingCanonicalUrls.has(canonicalUrl)) return false
      if (existingRawUrls.has(entry.item.url)) return false

      if (entry.sourceId) {
        const fp = createTitleFingerprint(entry.item.title)
        const knownForSource = existingFingerprintsBySource.get(entry.sourceId)
        if (fp && knownForSource?.has(fp)) return false
      }

      return true
    })
    .map((entry) => entry.item)
}
