/**
 * SWR hook for the paginated story feed.
 * Adapted from web — uses mobile fetcher, no browser-specific options.
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import type { NewsArticle, Topic, Region, BiasCategory, FactualityLevel, DatePreset } from '@/lib/shared/types'

interface StoriesParams {
  readonly topic?: Topic | null
  readonly region?: Region | null
  readonly search?: string
  readonly blindspot?: boolean
  readonly biasRange?: BiasCategory[]
  readonly minFactuality?: FactualityLevel | null
  readonly datePreset?: DatePreset
  readonly sort?: 'last_updated' | 'source_count'
  readonly ids?: string[]
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
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.ids && params.ids.length > 0) searchParams.set('ids', params.ids.join(','))
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const qs = searchParams.toString()
  return `/api/stories${qs ? `?${qs}` : ''}`
}

export function useStories(params: StoriesParams | null = {}) {
  const url = params === null ? null : buildStoriesUrl(params)

  const { data, error, isLoading, mutate } = useSWR<StoriesApiResponse>(
    url,
    { dedupingInterval: 5000 }
  )

  const stories = useMemo(() => data?.data ?? [], [data])

  return {
    stories,
    total: data?.meta?.total ?? 0,
    page: data?.meta?.page ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
