/**
 * lib/pipeline/dead-letter.ts — Helpers for the pipeline_dead_letter table.
 *
 * Items that exceed their retry budget land here instead of being
 * retried forever or silently abandoned. An admin UI can list, replay,
 * or dismiss entries (see app/api/admin/dlq/route.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type DlqItemKind = 'article_embed' | 'article_cluster' | 'story_assemble'

export interface DlqEntry {
  readonly id: string
  readonly itemKind: DlqItemKind
  readonly itemId: string
  readonly retryCount: number
  readonly lastError: string
  readonly failedAt: string
  readonly replayedAt: string | null
}

export interface DlqInsert {
  readonly itemKind: DlqItemKind
  readonly itemId: string
  readonly retryCount: number
  readonly lastError: string
}

/**
 * Append a single exhausted item to the dead letter queue.
 */
export async function pushToDeadLetter(
  client: SupabaseClient<Database>,
  entry: DlqInsert
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('pipeline_dead_letter') as any).insert({
    item_kind: entry.itemKind,
    item_id: entry.itemId,
    retry_count: entry.retryCount,
    last_error: entry.lastError,
  })

  if (error) {
    // Best-effort: log but never fail the stage because of audit-table trouble.
    console.warn(
      `[dlq] failed to record ${entry.itemKind}:${entry.itemId}: ${error.message}`
    )
  }
}

/**
 * Read unreplayed DLQ entries, newest first. Used by the admin dashboard.
 */
export async function listUnreplayed(
  client: SupabaseClient<Database>,
  limit = 50
): Promise<DlqEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('pipeline_dead_letter') as any)
    .select('id, item_kind, item_id, retry_count, last_error, failed_at, replayed_at')
    .is('replayed_at', null)
    .order('failed_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list DLQ entries: ${error.message}`)
  }

  return (data as Array<{
    id: string
    item_kind: DlqItemKind
    item_id: string
    retry_count: number
    last_error: string
    failed_at: string
    replayed_at: string | null
  }> | null ?? []).map((row) => ({
    id: row.id,
    itemKind: row.item_kind,
    itemId: row.item_id,
    retryCount: row.retry_count,
    lastError: row.last_error,
    failedAt: row.failed_at,
    replayedAt: row.replayed_at,
  }))
}

/**
 * Mark a DLQ entry as replayed and reset the underlying item's retry
 * metadata so the next pipeline pass picks it up. Works for all three
 * item kinds.
 *
 * Returns true if the entry existed and the underlying item was reset.
 */
export async function replayDeadLetterEntry(
  client: SupabaseClient<Database>,
  dlqId: string
): Promise<boolean> {
  // 1. Read the entry so we know what to reset.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: readError } = await (client.from('pipeline_dead_letter') as any)
    .select('id, item_kind, item_id')
    .eq('id', dlqId)
    .single()

  if (readError || !entry) {
    return false
  }

  const { item_kind: kind, item_id: itemId } = entry as {
    item_kind: DlqItemKind
    item_id: string
  }

  // 2. Reset the underlying row so the claim RPC will pick it up again.
  if (kind === 'article_embed') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any)
      .update({
        embedding_retry_count: 0,
        embedding_next_attempt_at: null,
        embedding_last_error: null,
        embedding_claimed_at: null,
        embedding_claim_owner: null,
      })
      .eq('id', itemId)
    if (error) throw new Error(`Failed to reset article ${itemId}: ${error.message}`)
  } else if (kind === 'article_cluster') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any)
      .update({
        clustering_retry_count: 0,
        clustering_next_attempt_at: null,
        clustering_last_error: null,
        clustering_claimed_at: null,
        clustering_claim_owner: null,
        clustering_status: 'pending',
      })
      .eq('id', itemId)
    if (error) throw new Error(`Failed to reset article ${itemId}: ${error.message}`)
  } else {
    // story_assemble: reuse the guarded requeue helper imported lazily
    // to avoid a circular import at module load time.
    const { fetchAssemblyVersions, requeueStoryForReassembly } = await import(
      '@/lib/pipeline/reassembly'
    )
    const versions = await fetchAssemblyVersions(client, [itemId])
    const expected = versions.get(itemId)
    if (expected === undefined) {
      throw new Error(`Cannot replay DLQ entry ${dlqId}: story ${itemId} has no assembly_version`)
    }
    // Also clear the retry metadata on the story.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from('stories') as any)
      .update({
        assembly_retry_count: 0,
        assembly_next_attempt_at: null,
        assembly_last_error: null,
      })
      .eq('id', itemId)
    await requeueStoryForReassembly(client, itemId, expected)
  }

  // 3. Mark the DLQ entry as replayed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: markError } = await (client.from('pipeline_dead_letter') as any)
    .update({ replayed_at: new Date().toISOString() })
    .eq('id', dlqId)

  if (markError) {
    throw new Error(`Failed to mark DLQ entry ${dlqId} replayed: ${markError.message}`)
  }

  return true
}

/**
 * Dismiss an entry without resetting the underlying row. Useful for
 * known-bad items the operator has decided to drop.
 */
export async function dismissDeadLetterEntry(
  client: SupabaseClient<Database>,
  dlqId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('pipeline_dead_letter') as any)
    .update({ replayed_at: new Date().toISOString() })
    .eq('id', dlqId)

  if (error) {
    throw new Error(`Failed to dismiss DLQ entry ${dlqId}: ${error.message}`)
  }
}
