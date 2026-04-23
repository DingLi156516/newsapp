/**
 * lib/hooks/use-oldest-pending.ts — SWR hook for the oldest-pending /
 * stale-claims / review-reasons SLO endpoint.
 *
 * Reads from GET /api/admin/pipeline/oldest-pending. Refreshed on focus
 * with a 5s dedupe — same cadence as usePipelineStats() so tiles stay
 * coherent.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'

export interface OldestPendingPayload {
  readonly oldest: {
    readonly oldestEmbedPendingAt: string | null
    readonly oldestClusterPendingAt: string | null
    readonly oldestAssemblyPendingAt: string | null
  }
  readonly stale: {
    readonly staleEmbedClaims: number
    readonly staleClusterClaims: number
    readonly staleAssemblyClaims: number
  }
  readonly reviewReasons: ReadonlyArray<{ readonly reason: string; readonly count: number }>
}

interface ApiResponse {
  readonly success: boolean
  readonly data: OldestPendingPayload
}

export function useOldestPending() {
  const { user } = useAuth()

  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    user ? '/api/admin/pipeline/oldest-pending' : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  )

  return {
    payload: data?.data ?? null,
    isLoading,
    // Expose the error so the SLO tiles can render a visible failure
    // banner instead of silently disappearing — this telemetry path is
    // exactly what operators check during a DB/RLS regression.
    error: error instanceof Error ? error.message : null,
    mutate,
  }
}
