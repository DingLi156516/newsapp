/**
 * lib/hooks/use-pipeline-events.ts — SWR hook for the pipeline stage
 * event drill-down endpoint.
 *
 * Reads from GET /api/admin/pipeline/events. Supports optional filters
 * (runId, stage, level). The SWR cache is keyed on the filter tuple so
 * changing any filter issues a fresh request. Admin-only: returns null
 * data when the current user is unauthenticated.
 *
 * See:
 *   - app/api/admin/pipeline/events/route.ts (endpoint)
 *   - components/organisms/PipelineEventsPanel.tsx (consumer)
 *   - lib/pipeline/stage-events.ts (StageKind / StageLevel)
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { DbPipelineStageEvent } from '@/lib/supabase/types'
import type { StageKind, StageLevel } from '@/lib/pipeline/stage-events'

export interface PipelineEventsFilter {
  readonly runId?: string
  readonly stage?: StageKind
  readonly levels?: readonly StageLevel[]
  readonly limit?: number
  readonly offset?: number
}

interface PipelineEventsResponse {
  readonly success: boolean
  readonly data: DbPipelineStageEvent[]
}

function buildQueryString(filter: PipelineEventsFilter): string {
  const params = new URLSearchParams()
  if (filter.runId) params.set('runId', filter.runId)
  if (filter.stage) params.set('stage', filter.stage)
  if (filter.levels && filter.levels.length > 0) {
    params.set('level', filter.levels.join(','))
  }
  if (typeof filter.limit === 'number') {
    params.set('limit', String(filter.limit))
  }
  if (typeof filter.offset === 'number') {
    params.set('offset', String(filter.offset))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function usePipelineEvents(filter: PipelineEventsFilter = {}) {
  const { user } = useAuth()

  const key = user
    ? `/api/admin/pipeline/events${buildQueryString(filter)}`
    : null

  const { data, isLoading, error, mutate } = useSWR<PipelineEventsResponse>(
    key,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  )

  return {
    events: data?.data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    mutate,
  }
}
