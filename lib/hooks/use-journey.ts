/**
 * lib/hooks/use-journey.ts — on-demand SWR for the operator journey
 * lookup. Fires only when query is non-empty.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { JourneyResult } from '@/lib/api/pipeline-journey'

interface ApiResponse {
  readonly success: boolean
  readonly data: JourneyResult
}

export function useJourney(query: string) {
  const { user } = useAuth()
  const trimmed = query.trim()
  const key = user && trimmed.length > 0
    ? `/api/admin/pipeline/journey?q=${encodeURIComponent(trimmed)}`
    : null

  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  })

  return {
    result: data?.data ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    mutate,
  }
}
