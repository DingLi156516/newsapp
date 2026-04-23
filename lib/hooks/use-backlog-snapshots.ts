/**
 * lib/hooks/use-backlog-snapshots.ts — SWR hook for the sparkline
 * tiles. 60s dedupe — snapshots are written every 15 minutes, so
 * faster polling would just hammer the cache.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { DbPipelineBacklogSnapshot } from '@/lib/supabase/types'

interface ApiResponse {
  readonly success: boolean
  readonly data: {
    readonly hours: number
    readonly snapshots: DbPipelineBacklogSnapshot[]
  }
}

export function useBacklogSnapshots(hours = 24) {
  const { user } = useAuth()

  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    user ? `/api/admin/pipeline/snapshots?hours=${hours}` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 60000 }
  )

  return {
    snapshots: data?.data.snapshots ?? [],
    isLoading,
    mutate,
  }
}
