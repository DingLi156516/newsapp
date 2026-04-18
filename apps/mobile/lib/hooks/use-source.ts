/**
 * SWR hook for a single source profile.
 * Fetches /api/sources/[slug] which returns { source, recentStories, topicBreakdown, blindspotCount }.
 */

import useSWR from 'swr'
import type { NewsSource, Topic, Region } from '@/lib/shared/types'

export interface SourceProfileSource extends NewsSource {
  readonly slug: string
  readonly rssUrl?: string
  readonly isActive: boolean
  readonly region?: Region
  readonly totalArticlesIngested?: number
}

export interface SourceProfileStory {
  readonly id: string
  readonly headline: string
  readonly topic: Topic
  readonly region: Region
  readonly timestamp: string
  readonly isBlindspot: boolean
  readonly articleUrl?: string
}

export interface SourceTopicBreakdownItem {
  readonly topic: Topic
  readonly count: number
}

export interface SourceProfile {
  readonly source: SourceProfileSource
  readonly recentStories: readonly SourceProfileStory[]
  readonly topicBreakdown: readonly SourceTopicBreakdownItem[]
  readonly blindspotCount: number
}

interface SourceApiResponse {
  readonly success: boolean
  readonly data?: SourceProfile
  readonly error?: string
}

export function useSource(slug: string | null | undefined) {
  const url = slug ? `/api/sources/${encodeURIComponent(slug)}` : null

  const { data, error, isLoading, mutate } = useSWR<SourceApiResponse>(
    url,
    { dedupingInterval: 10000 }
  )

  return {
    profile: data?.data ?? null,
    isLoading,
    isError: !!error || (data?.success === false),
    error: error ?? (data?.success === false ? new Error(data.error) : undefined),
    mutate,
  }
}
