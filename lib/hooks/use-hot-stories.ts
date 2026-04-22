/**
 * lib/hooks/use-hot-stories.ts — SWR hook for the Hot Now dashboard card.
 *
 * Returns the top 5 stories by recent unique-viewer count. Unlike
 * suggestions (which is bias-aware and per-user), Hot Now is global —
 * the same five stories surface for every authenticated user during the
 * 6-hour window.
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { NewsArticle } from '@/lib/types'

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
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  return {
    hotStories: data?.data ?? [],
    isLoading,
    isError: !!error,
  }
}
