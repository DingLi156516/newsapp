/**
 * lib/hooks/use-stories.ts — SWR hook for the paginated story feed.
 *
 * Wraps GET /api/stories with typed parameters and automatic revalidation.
 * Falls back to sampleArticles when the API is unavailable.
 *
 * --- What is SWR? ---
 * SWR stands for "Stale-While-Revalidate": when a component first renders,
 * SWR returns whatever is in its cache immediately (possibly stale data), then
 * fires an HTTP request in the background and updates the UI when fresh data
 * arrives. Java analogy: a read-through cache (like Spring Cache with
 * @Cacheable) that serves the cached value while silently refreshing it.
 *
 * --- How the cache key works ---
 * useSWR(url, fetcher) uses `url` as the cache key. Every unique URL string
 * maps to one cached response entry — similar to a Map<String, CachedResponse>
 * keyed by URL. Two components calling useStories({ topic: 'politics' }) will
 * share the same cache entry and trigger only one HTTP request.
 *
 * --- SWR options used here ---
 * revalidateOnFocus: true  — re-fetches automatically when the browser tab
 *   regains focus. Like a polling mechanism, but event-driven instead of
 *   time-based; keeps the feed fresh after the user switches tabs.
 *
 * dedupingInterval: 5000   — if multiple components call useStories() with the
 *   same URL within 5 seconds, only one HTTP request fires. Java analogy:
 *   request coalescing / "thundering herd" prevention.
 *
 * fallbackData              — data to show immediately before the first API
 *   response arrives, preventing a blank screen on first render. The sample
 *   articles act as a pre-populated cache entry. Once the real API responds,
 *   SWR replaces fallbackData with live data.
 *
 * mutate                    — function to manually trigger a re-fetch or
 *   update the cache directly. Java analogy: @CacheEvict followed by a
 *   refresh, or calling cacheManager.getCache("stories").clear().
 */

import useSWR from 'swr'
import type { NewsArticle, Topic, Region, BiasCategory, FactualityLevel, DatePreset } from '@/lib/types'
import { sampleArticles } from '@/lib/sample-data'
import { fetcher } from '@/lib/hooks/fetcher'

interface StoriesParams {
  readonly topic?: Topic | null
  readonly region?: Region | null
  readonly search?: string
  readonly blindspot?: boolean
  readonly biasRange?: BiasCategory[]
  readonly minFactuality?: FactualityLevel | null
  readonly datePreset?: DatePreset
  readonly page?: number
  readonly limit?: number
}

interface StoriesApiResponse {
  readonly success: boolean
  readonly data: NewsArticle[]
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}

// Constructs the query string for /api/stories.
// URLSearchParams is JavaScript's equivalent of Java's UriComponentsBuilder —
// it handles encoding and concatenation. Default values are intentionally
// omitted from the URL (e.g., perspective 'all' is never appended) so that
// cache entries for the common case share a clean key like /api/stories
// rather than /api/stories?perspective=all.
function buildStoriesUrl(params: StoriesParams): string {
  const searchParams = new URLSearchParams()

  if (params.topic) searchParams.set('topic', params.topic)
  if (params.region) searchParams.set('region', params.region)
  if (params.search?.trim()) searchParams.set('search', params.search.trim())
  if (params.blindspot) searchParams.set('blindspot', 'true')
  if (params.biasRange && params.biasRange.length > 0 && params.biasRange.length < 7) {
    searchParams.set('biasRange', params.biasRange.join(','))
  }
  if (params.minFactuality) searchParams.set('minFactuality', params.minFactuality)
  if (params.datePreset && params.datePreset !== 'all') searchParams.set('datePreset', params.datePreset)
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const qs = searchParams.toString()
  return `/api/stories${qs ? `?${qs}` : ''}`
}

export function useStories(params: StoriesParams = {}) {
  const url = buildStoriesUrl(params)

  const { data, error, isLoading, mutate } = useSWR<StoriesApiResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      fallbackData: {
        success: true,
        data: sampleArticles,
        meta: { total: sampleArticles.length, page: 1, limit: 20 },
      },
    }
  )

  return {
    stories: data?.data ?? sampleArticles,
    total: data?.meta?.total ?? 0,
    page: data?.meta?.page ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
