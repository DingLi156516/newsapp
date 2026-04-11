/**
 * lib/hooks/use-pipeline-maintenance.ts — Mutation wrapper around
 * POST /api/admin/maintenance.
 *
 * Returns a `runMaintenance` function that POSTs the action + dryRun
 * payload and resolves with the purge result (or throws on error).
 * This is a write-only hook — use SWR mutate on any read-side caches
 * (e.g., the maintenance audit log, pipeline stats) after a successful
 * real run.
 */

import useSWRMutation from 'swr/mutation'

export interface MaintenanceAction {
  readonly action:
    | 'purge_unembedded_articles'
    | 'purge_orphan_stories'
    | 'purge_expired_articles'
  readonly dryRun: boolean
  readonly olderThanDays?: number
}

export interface MaintenanceResult {
  readonly action: MaintenanceAction['action']
  readonly dryRun: boolean
  readonly deletedCount: number
  readonly sampleIds: readonly string[]
  readonly auditId: string
}

interface MaintenanceResponse {
  readonly success: boolean
  readonly data?: MaintenanceResult
  readonly error?: string
}

async function maintenanceFetcher(
  url: string,
  { arg }: { arg: MaintenanceAction }
): Promise<MaintenanceResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  })

  const body: MaintenanceResponse = await res
    .json()
    .catch(() => ({ success: false, error: `HTTP ${res.status}` }))

  if (!res.ok || !body.success || !body.data) {
    throw new Error(body.error ?? `Maintenance request failed: ${res.status}`)
  }
  return body.data
}

export function usePipelineMaintenance() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/maintenance',
    maintenanceFetcher
  )

  return {
    runMaintenance: trigger,
    isRunning: isMutating,
    error: error instanceof Error ? error.message : null,
  }
}
