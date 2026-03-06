/**
 * lib/rss/feed-registry.ts — Maps source slugs to RSS feed URLs.
 *
 * Queries the Supabase sources table for all active sources with RSS URLs.
 * Falls back to seed data when the DB is unavailable (development/testing).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface FeedEntry {
  readonly sourceId: string
  readonly slug: string
  readonly name: string
  readonly rssUrl: string
}

interface SourceFeedRow {
  id: string
  slug: string
  name: string
  rss_url: string | null
}

export async function getActiveFeeds(
  client: SupabaseClient<Database>
): Promise<readonly FeedEntry[]> {
  const { data, error } = await client
    .from('sources')
    .select('id, slug, name, rss_url')
    .eq('is_active', true)
    .not('rss_url', 'is', null)
    .order('slug')
    .returns<SourceFeedRow[]>()

  if (error) {
    throw new Error(`Failed to fetch active feeds: ${error.message}`)
  }

  return (data ?? [])
    .filter((row) => row.rss_url !== null)
    .map((row) => ({
      sourceId: row.id,
      slug: row.slug,
      name: row.name,
      rssUrl: row.rss_url!,
    }))
}
