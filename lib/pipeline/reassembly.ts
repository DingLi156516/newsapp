/**
 * lib/pipeline/reassembly.ts — Guarded reassembly transitions.
 *
 * Wraps the `requeue_story_for_reassembly` SECURITY DEFINER RPC
 * (migration 038) which performs a compare-and-set against an
 * `assembly_version` token. Callers must read the version first,
 * then call this helper; if the helper returns false, a concurrent
 * assembler is either already processing the story or another requeue
 * won the race — the caller should log a soft "guarded" event and skip.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface StoryVersionRow {
  readonly id: string
  readonly assembly_version: number
  readonly assembly_status?: string | null
}

/**
 * Fetch current assembly_version for a set of stories. Missing rows are
 * simply omitted. Callers use this to batch-read versions before looping
 * through requeue attempts.
 */
export async function fetchAssemblyVersions(
  client: SupabaseClient<Database>,
  storyIds: readonly string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (storyIds.length === 0) return map

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('stories') as any)
    .select('id, assembly_version, assembly_status')
  const withFilter = typeof query.in === 'function' ? query.in('id', storyIds) : query

  const { data, error } = await withFilter
  if (error) {
    throw new Error(`Failed to fetch assembly versions: ${error.message}`)
  }

  for (const row of (data ?? []) as StoryVersionRow[]) {
    if (typeof row.assembly_version === 'number') {
      map.set(row.id, row.assembly_version)
    }
  }
  return map
}

/**
 * Attempt a guarded requeue. Returns `true` if the story was reset to
 * pending, `false` if either the story is currently being assembled or
 * another requeue already bumped the version.
 *
 * The RPC (migration 042) unconditionally clears retry/backoff metadata
 * so any exhausted story becomes claimable again after a successful
 * requeue. Passing `clearContent = true` also wipes headline + ai_summary
 * + assembled_at + reviewer fields in the same atomic UPDATE — used by
 * admin manual reprocess so a failed CAS does not leave the story half-
 * wiped.
 */
export async function requeueStoryForReassembly(
  client: SupabaseClient<Database>,
  storyId: string,
  expectedVersion: number,
  clearContent = false
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('requeue_story_for_reassembly', {
    p_story_id: storyId,
    p_expected_version: expectedVersion,
    p_clear_content: clearContent,
  })

  if (error) {
    throw new Error(`Failed to requeue story ${storyId}: ${error.message}`)
  }

  return data === true
}

/**
 * Increment a story's `assembly_version` without changing its state.
 * Called by the story assembler after success or failure writes so any
 * concurrent requeue caller with a stale version read will see a mismatch
 * and skip its (now out-of-date) reset attempt.
 */
export async function bumpAssemblyVersion(
  client: SupabaseClient<Database>,
  storyId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any).rpc('bump_assembly_version', {
    p_story_id: storyId,
  })

  if (error) {
    // Non-fatal: the main state write already landed.
    console.warn(
      `Failed to bump assembly_version for ${storyId}: ${error.message}`
    )
  }
}
