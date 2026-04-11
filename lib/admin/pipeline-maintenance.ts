/**
 * lib/admin/pipeline-maintenance.ts — Operator-facing pipeline purges.
 *
 * Closes Codex review finding #11 (MEDIUM). Migrations 025 and 026 ran
 * destructive backlog cleanups as part of schema history; schema
 * history should be additive. The three purge functions here replace
 * those migrations function-for-function so future cleanups can run
 * from the admin dashboard with an audit trail instead of requiring
 * a fresh migration.
 *
 * Each purge is backed by an atomic SECURITY DEFINER SQL function
 * defined in migration 047. The SQL function returns the actual
 * affected ids via RETURNING so the audit row records the true delete
 * count, not an optimistic select count.
 *
 * TOCTOU safety:
 *   - purge_unembedded_articles: atomic DELETE with WHERE predicate.
 *   - purge_expired_articles: atomic DELETE; terminal state, no race.
 *   - purge_orphan_stories: atomic DELETE with `LOCK TABLE articles IN
 *     SHARE MODE` to block concurrent article writes for the window.
 *
 * The caller must pass a service-role Supabase client. The audit table
 * and the purge RPCs are protected by RLS — an anon/authenticated
 * client will be rejected at the audit insert.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/** Hard cap on rows touched per call. Repeat to drain. */
const PURGE_BATCH_SIZE = 1000

/** Number of sample IDs returned for operator review/diff. */
const SAMPLE_ID_COUNT = 20

type MaintenanceAction =
  | 'purge_unembedded_articles'
  | 'purge_orphan_stories'
  | 'purge_expired_articles'

export interface PurgeOptions {
  readonly dryRun: boolean
  readonly olderThanDays?: number
  readonly triggeredBy?: string | null
}

export interface PurgeResult {
  readonly action: MaintenanceAction
  readonly dryRun: boolean
  readonly deletedCount: number
  readonly sampleIds: readonly string[]
  readonly auditId: string
}

/**
 * Writes the "triggered" audit row. Returns the new audit id.
 * Throws on insert error so the caller can abort before mutating.
 */
async function insertAuditRow(
  client: SupabaseClient<Database>,
  action: MaintenanceAction,
  options: PurgeOptions
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('pipeline_maintenance_audit') as any)
    .insert({
      action,
      dry_run: options.dryRun,
      options: {
        olderThanDays: options.olderThanDays ?? null,
      },
      triggered_by: options.triggeredBy ?? null,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`maintenance_audit insert failed: ${error.message}`)
  }
  return data.id
}

/**
 * Finalizes the audit row with the delete result.
 *
 * Throws on failure (was previously swallowed). A successful purge
 * with a broken audit row is worse than a loud failure that an
 * operator can retry — the audit log is the primary evidence of what
 * ran, and a stale "unknown" row would undermine the whole point of
 * Phase 12.
 */
async function finalizeAuditRow(
  client: SupabaseClient<Database>,
  auditId: string,
  patch: {
    deleted_count: number
    sample_ids: string[]
    error?: string | null
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from('pipeline_maintenance_audit') as any)
    .update({
      deleted_count: patch.deleted_count,
      sample_ids: patch.sample_ids,
      error: patch.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  if (error) {
    throw new Error(
      `maintenance_audit finalize failed (audit_id=${auditId}): ${error.message}`
    )
  }
}

interface PurgeRpcRow {
  readonly deleted_id: string
}

/**
 * Runs a purge RPC and wraps the result in the standard audit + return
 * envelope. Centralizes error handling so every purge has identical
 * semantics: audit-first, rpc-second, finalize-third, throw loudly.
 */
async function runPurge(
  client: SupabaseClient<Database>,
  action: MaintenanceAction,
  options: PurgeOptions,
  rpcName: string,
  rpcArgs: Record<string, unknown>
): Promise<PurgeResult> {
  const auditId = await insertAuditRow(client, action, options)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)(rpcName, rpcArgs)

  if (error) {
    // Best-effort audit finalize with the error. If the finalize ALSO
    // fails, compose a single error that surfaces both failures so
    // neither gets silently lost — the audit row integrity guarantee
    // in Phase 12 is load-bearing and a quietly-swallowed finalize
    // failure would undermine it.
    try {
      await finalizeAuditRow(client, auditId, {
        deleted_count: 0,
        sample_ids: [],
        error: error.message,
      })
    } catch (finalizeErr) {
      const finalizeMsg =
        finalizeErr instanceof Error ? finalizeErr.message : String(finalizeErr)
      throw new Error(
        `${rpcName} failed: ${error.message}; additionally, ${finalizeMsg}`
      )
    }
    throw new Error(`${rpcName} failed: ${error.message}`)
  }

  const rows: PurgeRpcRow[] = Array.isArray(data) ? data : []
  const ids: string[] = rows
    .map((row) => row.deleted_id)
    .filter((id): id is string => typeof id === 'string')
  const sampleIds = ids.slice(0, SAMPLE_ID_COUNT)

  await finalizeAuditRow(client, auditId, {
    deleted_count: ids.length,
    sample_ids: sampleIds,
  })

  return {
    action,
    dryRun: options.dryRun,
    deletedCount: ids.length,
    sampleIds,
    auditId,
  }
}

/**
 * Replaces migration 025 predicate #1:
 *   DELETE FROM articles WHERE is_embedded = false AND created_at < now() - 7d.
 * Backed by `purge_unembedded_articles_batch` in migration 047.
 */
export async function purgeUnembeddedArticles(
  client: SupabaseClient<Database>,
  options: PurgeOptions
): Promise<PurgeResult> {
  return runPurge(
    client,
    'purge_unembedded_articles',
    options,
    'purge_unembedded_articles_batch',
    {
      p_older_than_days: options.olderThanDays ?? 7,
      p_limit: PURGE_BATCH_SIZE,
      p_dry_run: options.dryRun,
    }
  )
}

/**
 * Replaces migration 025 predicate #5 / migration 026 predicate #3.
 * Backed by `purge_orphan_stories_batch` in migration 047 which holds
 * a SHARE lock on `articles` for the duration of the DELETE.
 */
export async function purgeOrphanStories(
  client: SupabaseClient<Database>,
  options: PurgeOptions
): Promise<PurgeResult> {
  return runPurge(
    client,
    'purge_orphan_stories',
    options,
    'purge_orphan_stories_batch',
    {
      p_limit: PURGE_BATCH_SIZE,
      p_dry_run: options.dryRun,
    }
  )
}

/**
 * Replaces migration 025 predicate #2.
 * Backed by `purge_expired_articles_batch` in migration 047.
 */
export async function purgeExpiredArticles(
  client: SupabaseClient<Database>,
  options: PurgeOptions
): Promise<PurgeResult> {
  return runPurge(
    client,
    'purge_expired_articles',
    options,
    'purge_expired_articles_batch',
    {
      p_limit: PURGE_BATCH_SIZE,
      p_dry_run: options.dryRun,
    }
  )
}
