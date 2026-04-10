/**
 * lib/ingestion/source-registry.ts — Multi-type source registry.
 *
 * Queries all active sources from the database, returning them as
 * IngestionSource objects that include source_type and ingestion_config.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SourceType } from '@/lib/supabase/types'
import type { IngestionSource } from '@/lib/ingestion/types'

interface SourceRow {
  id: string
  slug: string
  name: string
  source_type: SourceType
  rss_url: string | null
  ingestion_config: Record<string, unknown>
}

export async function getActiveSources(
  client: SupabaseClient<Database>
): Promise<readonly IngestionSource[]> {
  const { data, error } = await client
    .from('sources')
    .select('id, slug, name, source_type, rss_url, ingestion_config')
    .eq('is_active', true)
    .order('slug')
    .returns<SourceRow[]>()

  if (error) {
    throw new Error(`Failed to fetch active sources: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    sourceId: row.id,
    slug: row.slug,
    name: row.name,
    sourceType: (row.source_type ?? 'rss') as SourceType,
    rssUrl: row.rss_url,
    config: row.ingestion_config ?? {},
  }))
}

export function groupByType(
  sources: readonly IngestionSource[]
): ReadonlyMap<SourceType, readonly IngestionSource[]> {
  const groups = new Map<SourceType, IngestionSource[]>()

  for (const source of sources) {
    const existing = groups.get(source.sourceType) ?? []
    groups.set(source.sourceType, [...existing, source])
  }

  return groups
}
