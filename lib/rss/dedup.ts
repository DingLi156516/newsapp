/**
 * lib/rss/dedup.ts — URL-based deduplication for RSS articles.
 *
 * Checks which article URLs already exist in the database to avoid
 * re-inserting duplicate articles. Uses batch queries for efficiency.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ParsedFeedItem } from '@/lib/rss/parser'

const BATCH_SIZE = 20

export async function filterNewArticles(
  client: SupabaseClient<Database>,
  items: readonly ParsedFeedItem[]
): Promise<readonly ParsedFeedItem[]> {
  if (items.length === 0) {
    return []
  }

  const urls = items.map((item) => item.url)
  const existingUrls = new Set<string>()

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)

    const { data, error } = await client
      .from('articles')
      .select('url')
      .in('url', batch)
      .returns<Array<{ url: string }>>()

    if (error) {
      throw new Error(
        `Dedup query failed (batch ${i / BATCH_SIZE + 1}, ${batch.length} urls): ${error.message}`
      )
    }

    for (const row of data ?? []) {
      existingUrls.add(row.url)
    }
  }

  return items.filter((item) => !existingUrls.has(item.url))
}
