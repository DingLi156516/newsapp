/**
 * lib/api/bias-sync-queries.ts — DB sync orchestrator for third-party bias ratings.
 *
 * Looks up each source in MBFC, AllSides, and Ad Fontes datasets,
 * writes per-provider columns, and optionally updates effective bias/factuality.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { SyncResult } from '@/lib/bias-ratings/types'
import { lookupMbfc } from '@/lib/bias-ratings/providers/mbfc'
import { lookupAllSides } from '@/lib/bias-ratings/providers/allsides'
import { lookupAdFontes } from '@/lib/bias-ratings/providers/adfontesmedia'
import { aggregateRatings } from '@/lib/bias-ratings/aggregator'

export async function syncProviderRatings(
  client: SupabaseClient<Database>
): Promise<SyncResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error } = await (client.from('sources') as any)
    .select('id, url, name, slug, bias, factuality, bias_override')

  if (error) {
    throw new Error(`Failed to fetch sources: ${error.message}`)
  }

  let synced = 0
  let skipped = 0
  let overridden = 0
  let unmatched = 0
  const errors: { source: string; reason: string }[] = []

  // Phase 1: Prepare all update payloads (pure/sync)
  const updates: { id: string; name: string; data: Record<string, unknown> }[] = []

  for (const source of sources ?? []) {
    if (!source.url) {
      skipped++
      continue
    }

    try {
      const mbfc = lookupMbfc(source.url)
      const allsides = lookupAllSides(source.url)
      const adfm = lookupAdFontes(source.url)

      const updateData: Record<string, unknown> = {
        bias_mbfc: mbfc.rating?.bias ?? null,
        bias_allsides: allsides.rating?.bias ?? null,
        bias_adfm: adfm.rating?.bias ?? null,
        factuality_mbfc: mbfc.rating?.factuality ?? null,
        factuality_allsides: allsides.rating?.factuality ?? null,
        bias_sources_synced_at: new Date().toISOString(),
      }

      if (!source.bias_override) {
        const providerRatings = [
          mbfc.rating,
          allsides.rating,
          adfm.rating,
        ].filter((r) => r !== null)

        if (providerRatings.length > 0) {
          const aggregated = aggregateRatings(providerRatings)
          if (aggregated.bias !== null) {
            updateData.bias = aggregated.bias
          }
          if (aggregated.factuality !== null) {
            updateData.factuality = aggregated.factuality
          }
        } else {
          unmatched++
        }
      } else {
        overridden++
      }

      updates.push({ id: source.id, name: source.name, data: updateData })
    } catch (err) {
      errors.push({
        source: source.name,
        reason: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // Phase 2: Batch DB writes in chunks of 10
  const BATCH_SIZE = 10
  for (let start = 0; start < updates.length; start += BATCH_SIZE) {
    const batch = updates.slice(start, start + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async ({ id, name, data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (client.from('sources') as any)
          .update(data)
          .eq('id', id)
        return { name, error: updateError }
      })
    )

    for (const { name, error: updateError } of results) {
      if (updateError) {
        errors.push({ source: name, reason: updateError.message })
      } else {
        synced++
      }
    }
  }

  return { synced, skipped, overridden, unmatched, errors }
}
