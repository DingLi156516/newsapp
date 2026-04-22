/**
 * SWR hook for the Hot Now mobile card.
 *
 * Returns the top 5 stories by recent unique-viewer count. Auth-gated;
 * unauthenticated users see no card.
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import type { NewsArticle } from '@/lib/shared/types'

export interface HotStory extends NewsArticle {
  readonly uniqueViewers6h: number
}

interface HotStoriesApiResponse {
  readonly success: boolean
  readonly data: HotStory[]
}

export function useHotStories() {
  const { user } = useAuth()

  const { data, error, isLoading } = useSWR<HotStoriesApiResponse>(
    user ? '/api/dashboard/hot-stories' : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  const hotStories = useMemo(() => data?.data ?? [], [data])

  return {
    hotStories,
    isLoading,
    isError: !!error,
  }
}
