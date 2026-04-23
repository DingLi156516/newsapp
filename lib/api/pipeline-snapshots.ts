/**
 * lib/api/pipeline-snapshots.ts — read-side helper for the
 * pipeline_backlog_snapshots table.
 *
 * Returns rows oldest → newest so charts can render left → right.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbPipelineBacklogSnapshot } from '@/lib/supabase/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<Database> | any

export async function queryBacklogSnapshots(
  client: Client,
  hours = 24
): Promise<DbPipelineBacklogSnapshot[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('pipeline_backlog_snapshots')
    .select('captured_at, unembedded_count, unclustered_count, pending_assembly_count, review_queue_count, stale_claim_count')
    .gte('captured_at', since)
    .order('captured_at', { ascending: true })

  if (error) throw new Error(`Failed to load backlog snapshots: ${error.message}`)
  return (data ?? []) as DbPipelineBacklogSnapshot[]
}
