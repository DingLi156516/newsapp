/**
 * lib/pipeline/backlog-snapshot.ts — best-effort snapshot writer for the
 * pipeline_backlog_snapshots table (migration 059).
 *
 * Called from app/api/cron/process/route.ts after the run completes.
 * Failures are swallowed: telemetry must never break the pipeline.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { countPipelineBacklog } from '@/lib/pipeline/backlog'
import { queryStaleClaimCounts } from '@/lib/api/pipeline-oldest-pending'

export async function captureBacklogSnapshot(
  client: SupabaseClient<Database>
): Promise<void> {
  try {
    const [backlog, stale] = await Promise.all([
      countPipelineBacklog(client),
      queryStaleClaimCounts(client),
    ])

    const totalStale =
      stale.staleEmbedClaims + stale.staleClusterClaims + stale.staleAssemblyClaims

    // Supabase resolves with { error } on RLS/schema failures instead of
    // throwing, so the try/catch alone would not notice a silent failure.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('pipeline_backlog_snapshots') as any).insert({
      unembedded_count: backlog.unembeddedArticles,
      unclustered_count: backlog.unclusteredArticles,
      pending_assembly_count: backlog.pendingAssemblyStories,
      review_queue_count: backlog.reviewQueueStories,
      stale_claim_count: totalStale,
    })
    if (error) {
      console.warn(`captureBacklogSnapshot insert rejected: ${error.message}`)
    }
  } catch (err) {
    // Telemetry write must never break the pipeline.
    console.warn('captureBacklogSnapshot failed', err)
  }
}
