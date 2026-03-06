/**
 * lib/hooks/use-story-timeline.ts — SWR hook for a story's coverage timeline.
 *
 * Wraps GET /api/stories/[id]/timeline with typed response and sample fallback.
 * Uses a longer deduping interval (30s) since timelines are stable.
 */

import useSWR from 'swr'
import type { StoryTimeline } from '@/lib/types'
import { sampleTimelines } from '@/lib/sample-timeline'
import { fetcher } from '@/lib/hooks/fetcher'

interface TimelineApiResponse {
  readonly success: boolean
  readonly data: StoryTimeline
}

export function useStoryTimeline(id: string) {
  const { data, error, isLoading } = useSWR<TimelineApiResponse>(
    id ? `/api/stories/${id}/timeline` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const fallback = sampleTimelines[id] ?? null
  const timeline = data?.data ?? fallback

  return {
    timeline,
    isLoading,
    isError: !!error,
    error,
  }
}
