/**
 * lib/ingestion/source-registry.ts — Multi-type source registry.
 *
 * Queries all eligible sources from the database. Eligibility is enforced
 * by `isSourceEligible` (lib/ingestion/source-policy.ts), which folds the
 * `is_active`, `auto_disabled_at`, and `cooldown_until` checks into one
 * predicate. The DB-side filter mirrors the partial index
 * `idx_sources_eligible` (migration 046) exactly —
 * `is_active = true AND auto_disabled_at IS NULL` — so PostgreSQL can use
 * the index. The in-memory filter then handles the moving cooldown
 * timestamp (stable DB predicates + moving TS check is cheaper than
 * maintaining `now()` in the WHERE clause and re-planning).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SourceType } from '@/lib/supabase/types'
import type { IngestionSource } from '@/lib/ingestion/types'
import { isSourceEligible } from '@/lib/ingestion/source-policy'

interface SourceRow {
  id: string
  slug: string
  name: string
  source_type: SourceType
  rss_url: string | null
  ingestion_config: Record<string, unknown> | null
  is_active: boolean
  cooldown_until: string | null
  auto_disabled_at: string | null
}

export async function getActiveSources(
  client: SupabaseClient<Database>
): Promise<readonly IngestionSource[]> {
  const { data, error } = await client
    .from('sources')
    .select(
      'id, slug, name, source_type, rss_url, ingestion_config, is_active, cooldown_until, auto_disabled_at'
    )
    .eq('is_active', true)
    .is('auto_disabled_at', null)
    .order('slug')
    .returns<SourceRow[]>()

  if (error) {
    throw new Error(`Failed to fetch active sources: ${error.message}`)
  }

  const now = new Date()
  return (data ?? [])
    .filter((row) =>
      isSourceEligible(
        {
          // The eligibility check only reads three fields. Cast through
          // unknown so we don't have to fabricate a complete DbSource shape
          // here — the registry never needs the rest.
          is_active: row.is_active,
          auto_disabled_at: row.auto_disabled_at,
          cooldown_until: row.cooldown_until,
        } as Parameters<typeof isSourceEligible>[0],
        now
      )
    )
    .map((row) => ({
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
