/**
 * lib/hooks/use-top-errors.ts — SWR hook for the top-errors panel.
 * 30s dedupe — errors are slower-moving than the live stats tiles.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { TopErrorRow } from '@/lib/api/pipeline-top-errors'

interface ApiResponse {
  readonly success: boolean
  readonly data: { readonly windowHours: number; readonly errors: TopErrorRow[] }
}

export function useTopErrors(windowHours = 24) {
  const { user } = useAuth()

  const { data, isLoading, error, mutate } = useSWR<ApiResponse>(
    user ? `/api/admin/pipeline/top-errors?window=${windowHours}` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30000 }
  )

  return {
    errors: data?.data.errors ?? [],
    windowHours: data?.data.windowHours ?? windowHours,
    isLoading,
    error: error instanceof Error ? error.message : null,
    mutate,
  }
}
