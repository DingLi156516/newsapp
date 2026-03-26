/**
 * SWR hook for the sources directory.
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import type { NewsSource, BiasCategory, FactualityLevel, OwnershipType, Region } from '@/lib/shared/types'

interface SourcesParams {
  readonly bias?: BiasCategory | null
  readonly factuality?: FactualityLevel | null
  readonly ownership?: OwnershipType | null
  readonly region?: Region | null
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
    { dedupingInterval: 10000 }
  )

  const sources = useMemo(() => data?.data ?? [], [data])

  return {
    sources,
    total: data?.meta?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
