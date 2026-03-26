/**
 * lib/rss/dedup.ts — URL-based deduplication for RSS articles.
 *
 * Checks which article URLs already exist in the database to avoid
 * re-inserting duplicate articles. Uses batch queries for efficiency.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ParsedFeedItem } from '@/lib/rss/parser'
import { normalizeArticleUrl } from '@/lib/rss/normalization'

const BATCH_SIZE = 20

export async function filterNewArticles(
  client: SupabaseClient<Database>,
  items: readonly ParsedFeedItem[]
): Promise<readonly ParsedFeedItem[]> {
  if (items.length === 0) {
    return []
  }

  const canonicalUrls = items.map((item) => normalizeArticleUrl(item.url))
  const rawUrls = items.map((item) => item.url)
  const existingCanonicalUrls = new Set<string>()
  const existingRawUrls = new Set<string>()

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

  return items.filter((item) => {
    const canonicalUrl = normalizeArticleUrl(item.url)
    return !existingCanonicalUrls.has(canonicalUrl) && !existingRawUrls.has(item.url)
  })
}
