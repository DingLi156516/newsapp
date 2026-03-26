/**
 * SWR hook for story timeline data.
 */

import useSWR from 'swr'
import type { StoryTimeline } from '@/lib/shared/types'

interface TimelineApiResponse {
  readonly success: boolean
  readonly data: StoryTimeline
}

export function useStoryTimeline(storyId: string) {
  const { data, error, isLoading } = useSWR<TimelineApiResponse>(
    storyId ? `/api/stories/${storyId}/timeline` : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    timeline: data?.data ?? null,
    isLoading,
    isError: !!error,
    error,
  }
}
