/**
 * lib/hooks/use-sources.ts — SWR hook for the source directory.
 *
 * Wraps GET /api/sources with typed filtering and fallback.
 *
 * --- SWR behaviour (same pattern as use-stories.ts) ---
 * useSWR returns cached data immediately, then re-fetches in the background
 * ("Stale-While-Revalidate"). The URL string is the cache key, so two
 * components rendering useSources() with identical params share one cache
 * entry and one HTTP request. See use-stories.ts for a full SWR primer.
 *
 * --- SWR options used here ---
 * revalidateOnFocus: true   — re-fetches when the browser tab regains focus,
 *   keeping the source list fresh if an admin has added/updated sources.
 *
 * dedupingInterval: 10000   — sources change less often than stories, so
 *   10-second deduplication (vs 5 s for the feed) reduces redundant requests.
 *
 * fallbackData              — pre-populates the cache with all 55 sources so
 *   the page renders immediately without a loading spinner. limit: 50 matches
 *   the sources-page default; the full allSources array (55 items) slightly
 *   exceeds it, which is intentional — the API will enforce the limit on real
 *   requests while the fallback shows all available data locally.
 *
 * mutate                    — exposed in the return value so parent components
 *   can force a re-fetch after a user action (e.g., after applying a filter
 *   that requires a full reload). Java analogy: calling
 *   cacheManager.getCache("sources").evict(key) then fetching again.
 */

import useSWR from 'swr'
import type { NewsSource, BiasCategory, FactualityLevel, OwnershipType, Region } from '@/lib/types'
import { allSources } from '@/lib/sample-data'
import { fetcher } from '@/lib/hooks/fetcher'

interface SourcesParams {
  readonly bias?: BiasCategory
  readonly factuality?: FactualityLevel
  readonly ownership?: OwnershipType
  readonly region?: Region
  readonly search?: string
  readonly page?: number
  readonly limit?: number
}

interface SourcesApiResponse {
  readonly success: boolean
  readonly data: NewsSource[]
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}

function buildSourcesUrl(params: SourcesParams): string {
  const searchParams = new URLSearchParams()

  if (params.bias) searchParams.set('bias', params.bias)
  if (params.factuality) searchParams.set('factuality', params.factuality)
  if (params.ownership) searchParams.set('ownership', params.ownership)
  if (params.region) searchParams.set('region', params.region)
  if (params.search?.trim()) searchParams.set('search', params.search.trim())
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const qs = searchParams.toString()
  return `/api/sources${qs ? `?${qs}` : ''}`
}

export function useSources(params: SourcesParams = {}) {
  const url = buildSourcesUrl(params)

  const { data, error, isLoading, mutate } = useSWR<SourcesApiResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10000,
      fallbackData: {
        success: true,
        data: allSources,
        meta: { total: allSources.length, page: 1, limit: 50 },
      },
    }
  )

  return {
    sources: data?.data ?? allSources,
    total: data?.meta?.total ?? 0,
    page: data?.meta?.page ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
