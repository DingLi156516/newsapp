/**
 * lib/hooks/use-pipeline.ts — SWR hooks for pipeline admin dashboard.
 *
 * Provides hooks for pipeline run history, source health, and pipeline trigger.
 */

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { DbPipelineRun } from '@/lib/supabase/types'

interface PipelineRunsResponse {
  readonly success: boolean
  readonly data: DbPipelineRun[]
}

interface SourceHealthEntry {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly bias: string
  readonly region: string
  readonly source_type: string
  readonly is_active: boolean
  readonly last_fetch_at: string | null
  readonly last_fetch_status: string
  readonly last_fetch_error: string | null
  readonly consecutive_failures: number
  readonly total_articles_ingested: number
  readonly needs_attention?: boolean
  // Source-health control plane (Phase 11):
  readonly cooldown_until: string | null
  readonly auto_disabled_at: string | null
  readonly auto_disabled_reason: string | null
}

interface SourceHealthResponse {
  readonly success: boolean
  readonly data: SourceHealthEntry[]
}

interface TriggerResponse {
  readonly success: boolean
  readonly data?: Record<string, unknown>
  readonly error?: string
}

async function triggerFetcher(
  url: string,
  { arg }: { arg: { type: 'ingest' | 'process' | 'full' } }
): Promise<TriggerResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(data.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function usePipelineRuns(limit = 20) {
  const { user } = useAuth()

  const { data, isLoading, mutate } = useSWR<PipelineRunsResponse>(
    user ? `/api/admin/pipeline?limit=${limit}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  )

  return {
    runs: data?.data ?? [],
    isLoading,
    mutate,
  }
}

export function useSourceHealth() {
  const { user } = useAuth()

  const { data, isLoading, mutate } = useSWR<SourceHealthResponse>(
    user ? '/api/admin/pipeline/sources' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  )

  return {
    sources: data?.data ?? [],
    isLoading,
    mutate,
  }
}

export function usePipelineTrigger() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/pipeline/trigger',
    triggerFetcher
  )

  return {
    trigger,
    isTriggering: isMutating,
    error: error instanceof Error ? error.message : null,
  }
}

export interface PipelineStats {
  readonly publishedStories: number
  readonly totalArticles: number
  readonly reviewQueue: number
  readonly unembedded: number
  readonly unclustered: number
  readonly expiredArticles: number
}

interface PipelineStatsResponse {
  readonly success: boolean
  readonly data: PipelineStats
}

export function usePipelineStats() {
  const { user } = useAuth()

  const { data, isLoading, mutate } = useSWR<PipelineStatsResponse>(
    user ? '/api/admin/pipeline/stats' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  )

  return {
    stats: data?.data ?? null,
    isLoading,
    mutate,
  }
}

export type { SourceHealthEntry }
