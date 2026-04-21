/**
 * lib/hooks/use-routing-preview.ts — SWR hook for the admin routing
 * preview endpoint. Resolves which assembly path the pipeline would
 * choose for a story given its current articles and source biases.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { BiasCategory } from '@/lib/types'

export interface RoutingPreview {
  readonly storyId: string
  readonly sourceCount: number
  readonly biases: readonly BiasCategory[]
  readonly distinctBiasBuckets: number
  readonly assemblyPath: 'rich' | 'single' | 'thin'
  readonly appliedThresholds: {
    readonly minSources: number
    readonly minBuckets: number
    readonly modeOverride: 'deterministic' | 'gemini' | null
  }
}

interface RoutingPreviewResponse {
  readonly success: boolean
  readonly data: RoutingPreview
}

export function useRoutingPreview(storyId: string | null) {
  const { user } = useAuth()
  const url = storyId ? `/api/admin/review/${storyId}/routing-preview` : null

  const { data, isLoading, error } = useSWR<RoutingPreviewResponse>(
    user && url ? url : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  return {
    preview: data?.data ?? null,
    isLoading,
    error,
  }
}
